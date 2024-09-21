import { AudioCache } from "./AudioCache";
import config from "./config";
import { base64ToArrayBuffer } from "../utils";

export class AudioFileManager {
  private static instance: AudioFileManager | null = null;
  private audioCache: AudioCache;
  private inMemoryCache: Map<string, AudioBuffer> = new Map();
  private notFoundFiles: Set<string> = new Set();
  private lastGenerationAttempt: Map<string, number> = new Map();
  private lastFetchAttempt: Map<string, number> = new Map();

  constructor(private audioContext: AudioContext) {
    this.audioCache = new AudioCache();
  }

  public static getInstance(audioContext: AudioContext): AudioFileManager {
    if (!AudioFileManager.instance) {
      AudioFileManager.instance = new AudioFileManager(audioContext);
    }
    return AudioFileManager.instance;
  }

  async getAudioBuffer(filePath: string): Promise<AudioBuffer | null> {
    if (this.notFoundFiles.has(filePath)) {
      return null;
    }

    if (this.inMemoryCache.has(filePath)) {
      return this.inMemoryCache.get(filePath)!;
    }

    const arrayBuffer = await this.fetchAndProcessAudio(filePath);
    if (!arrayBuffer) {
      return null;
    }

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(
        arrayBuffer.slice(0)
      );
      this.inMemoryCache.set(filePath, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error(`Failed to decode audio data for ${filePath}:`, error);
      return null;
    }
  }

  async generateAudio(filePath: string, text: string): Promise<void> {
    const now = Date.now();
    const lastAttempt = this.lastGenerationAttempt.get(filePath) || 0;

    if (now - lastAttempt < config.audioFileGenerationCacheTimeout) {
      return;
    }

    return this.performAudioGeneration(filePath, text);
  }

  clearCache(): void {
    this.inMemoryCache.clear();
    this.notFoundFiles.clear();
    this.lastGenerationAttempt.clear();
    this.lastFetchAttempt.clear();
  }

  stop(): void {
    this.clearCache();
  }

  private async fetchAndProcessAudio(
    filePath: string
  ): Promise<ArrayBuffer | null> {
    try {
      let audioData = await this.audioCache.getAudio(filePath);

      if (!audioData) {
        audioData = await this.fetchAudioFile(filePath);
        if (!audioData) {
          this.notFoundFiles.add(filePath);
          return null;
        }
        await this.audioCache.storeAudio(filePath, audioData);
      }

      return audioData;
    } catch (error) {
      console.error("Error fetching or processing audio:", error);
      return null;
    }
  }

  public async fetchAudioFile(filePath: string): Promise<ArrayBuffer | null> {
    const now = Date.now();
    const lastAttempt = this.lastFetchAttempt.get(filePath) || 0;

    if (now - lastAttempt < config.audioFileFetchCacheTimeout) {
      return null;
    }

    const fetchPromise = new Promise<ArrayBuffer | null>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "fetchAudioFile", filePath },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response.error) {
            reject(new Error(response.error));
          } else if (response.audioData) {
            resolve(base64ToArrayBuffer(response.audioData));
          } else {
            resolve(null);
          }
        }
      );
    });

    this.lastFetchAttempt.set(filePath, now);

    try {
      const result = await fetchPromise;
      if (result) {
        await this.audioCache.storeAudio(filePath, result);
      }
      return result;
    } catch (error) {
      return null;
    } finally {
      this.notFoundFiles.delete(filePath);
    }
  }

  private async performAudioGeneration(
    filePath: string,
    text: string
  ): Promise<void> {
    try {
      this.lastGenerationAttempt.set(filePath, Date.now());
      const audioBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "generateAudio", filePath, text },
          (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else if (response.audioData) {
              resolve(base64ToArrayBuffer(response.audioData));
            } else {
              reject(new Error("No audio data received"));
            }
          }
        );
      });

      await this.audioCache.storeAudio(filePath, audioBuffer);

      const decodedBuffer = await this.audioContext.decodeAudioData(
        audioBuffer.slice(0)
      );
      this.inMemoryCache.set(filePath, decodedBuffer);

      this.notFoundFiles.delete(filePath);
    } catch (error) {
      console.error(`Failed to generate audio for ${filePath}:`, error);
      this.notFoundFiles.add(filePath);
    } finally {
      this.notFoundFiles.delete(filePath);
    }
  }

  public async cacheAudioBuffer(
    filePath: string,
    audioBuffer: ArrayBuffer
  ): Promise<void> {
    try {
      const buffer = await this.audioContext.decodeAudioData(
        audioBuffer.slice(0)
      );
      this.inMemoryCache.set(filePath, buffer);
      await this.audioCache.storeAudio(filePath, audioBuffer);
    } catch (error) {
      console.error(`Error caching audio buffer for ${filePath}:`, error);
    }
  }
}
