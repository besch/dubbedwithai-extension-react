import { AudioCache } from "./AudioCache";
import config from "./config";
import { base64ToArrayBuffer } from "../utils";

export class AudioFileManager {
  private static instance: AudioFileManager | null = null;
  private audioCache: AudioCache;
  private inMemoryCache: Map<string, AudioBuffer> = new Map();
  private ongoingFetchRequests: Map<string, Promise<AudioBuffer | null>> = new Map();
  private ongoingCheckRequests: Map<string, Promise<boolean>> = new Map();
  private ongoingGenerationRequests: Map<string, Promise<void>> = new Map();
  private notFoundFiles: Set<string> = new Set();
  private existenceCache: Map<string, boolean> = new Map();
  private lastExistenceCheck: Map<string, number> = new Map();
  private lastGenerationAttempt: Map<string, number> = new Map();

  constructor(private audioContext: AudioContext) {
    this.audioCache = new AudioCache();
  }

  public static getInstance(audioContext: AudioContext): AudioFileManager {
    if (!AudioFileManager.instance) {
      AudioFileManager.instance = new AudioFileManager(audioContext);
    }
    return AudioFileManager.instance;
  }

  isGenerating(filePath: string): boolean {
    return this.ongoingGenerationRequests.has(filePath);
  }

  async checkFileExists(filePath: string): Promise<boolean> {
    if (this.notFoundFiles.has(filePath)) return false;
    if (this.inMemoryCache.has(filePath) || this.ongoingFetchRequests.has(filePath)) return true;

    const now = Date.now();
    const lastCheck = this.lastExistenceCheck.get(filePath) || 0;

    if (now - lastCheck < config.audioFileExistenceCacheTimeout) {
      return this.existenceCache.get(filePath) || false;
    }

    if (!this.ongoingCheckRequests.has(filePath)) {
      const checkPromise = this.performFileCheck(filePath);
      this.ongoingCheckRequests.set(filePath, checkPromise);
    }

    return this.ongoingCheckRequests.get(filePath)!;
  }

  async getAudioBuffer(filePath: string): Promise<AudioBuffer | null> {
    if (this.notFoundFiles.has(filePath)) return null;

    if (this.inMemoryCache.has(filePath)) return this.inMemoryCache.get(filePath)!;

    if (!this.ongoingFetchRequests.has(filePath)) {
      const request = this.fetchAndProcessAudio(filePath);
      this.ongoingFetchRequests.set(filePath, request);
    }

    return this.ongoingFetchRequests.get(filePath)!;
  }

  async generateAudio(filePath: string, text: string): Promise<void> {
    const now = Date.now();
    const lastAttempt = this.lastGenerationAttempt.get(filePath) || 0;

    if (now - lastAttempt < config.audioFileGenerationCacheTimeout) {
      return;
    }

    if (!this.ongoingGenerationRequests.has(filePath)) {
      const generationPromise = this.performAudioGeneration(filePath, text);
      this.ongoingGenerationRequests.set(filePath, generationPromise);
    }

    return this.ongoingGenerationRequests.get(filePath);
  }

  clearCache(): void {
    this.inMemoryCache.clear();
    this.ongoingFetchRequests.clear();
    this.ongoingCheckRequests.clear();
    this.ongoingGenerationRequests.clear();
    this.notFoundFiles.clear();
    this.existenceCache.clear();
    this.lastExistenceCheck.clear();
    this.lastGenerationAttempt.clear();
  }

  stop(): void {
    this.clearCache();
  }

  private async performFileCheck(filePath: string): Promise<boolean> {
    try {
      const audioData = await this.audioCache.getAudio(filePath);
      if (audioData) {
        this.existenceCache.set(filePath, true);
        this.lastExistenceCheck.set(filePath, Date.now());
        return true;
      }

      const exists = await this.checkFileExistsInBackend(filePath);
      this.existenceCache.set(filePath, exists);
      this.lastExistenceCheck.set(filePath, Date.now());
      return exists;
    } finally {
      this.ongoingCheckRequests.delete(filePath);
    }
  }

  private async checkFileExistsInBackend(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "checkAudioFileExists", filePath },
        (response) => resolve(response.exists)
      );
    });
  }

  private async fetchAndProcessAudio(filePath: string): Promise<AudioBuffer | null> {
    try {
      let audioData = await this.audioCache.getAudio(filePath);

      if (!audioData) {
        if (this.ongoingGenerationRequests.has(filePath)) {
          await this.ongoingGenerationRequests.get(filePath);
          audioData = await this.audioCache.getAudio(filePath);
        }

        if (!audioData) {
          audioData = await this.fetchAudioFile(filePath);
          if (!audioData) {
            this.notFoundFiles.add(filePath);
            return null;
          }
          await this.audioCache.storeAudio(filePath, audioData);
        }
      }

      const buffer = await this.audioContext.decodeAudioData(audioData.slice(0));
      this.inMemoryCache.set(filePath, buffer);
      return buffer;
    } catch (error) {
      console.error("Error fetching or processing audio:", error);
      return null;
    } finally {
      this.ongoingFetchRequests.delete(filePath);
    }
  }

  private async fetchAudioFile(filePath: string): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "requestAudioFile", filePath },
        (response: any) => {
          if (response?.action === "audioFileData" && response.data) {
            resolve(base64ToArrayBuffer(response.data));
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  private async performAudioGeneration(filePath: string, text: string): Promise<void> {
    try {
      this.lastGenerationAttempt.set(filePath, Date.now());
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "generateAudio", filePath, text },
          (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve();
            }
          }
        );
      });
      this.notFoundFiles.delete(filePath);
      this.existenceCache.set(filePath, true);
      this.lastExistenceCheck.set(filePath, Date.now());
    } catch (error) {
      console.error(`Failed to generate audio for ${filePath}:`, error);
      this.notFoundFiles.add(filePath);
    } finally {
      this.ongoingGenerationRequests.delete(filePath);
    }
  }
}
