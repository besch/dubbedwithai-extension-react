import { AudioCache } from "./AudioCache";
import { base64ToArrayBuffer, log, LogLevel } from "./utils";

export class AudioFileManager {
  private audioCache: AudioCache;
  private inMemoryCache: Map<string, AudioBuffer> = new Map();
  private ongoingFetchRequests: Map<string, Promise<AudioBuffer | null>> =
    new Map();
  private notFoundFiles: Set<string> = new Set();
  private audioGenerationQueue: Set<string> = new Set();

  constructor(private audioContext: AudioContext) {
    this.audioCache = new AudioCache();
  }

  isGenerating(filePath: string): boolean {
    return this.audioGenerationQueue.has(filePath);
  }

  async checkFileExists(filePath: string): Promise<boolean> {
    if (this.notFoundFiles.has(filePath)) return false;
    if (
      this.inMemoryCache.has(filePath) ||
      this.ongoingFetchRequests.has(filePath)
    )
      return true;

    const audioData = await this.audioCache.getAudio(filePath);
    if (audioData) return true;

    const exists = await this.checkFileExistsInBackend(filePath);
    if (!exists && !this.audioGenerationQueue.has(filePath)) {
      this.requestAudioGeneration(filePath);
    }
    return exists;
  }

  async getAudioBuffer(filePath: string): Promise<AudioBuffer | null> {
    if (this.notFoundFiles.has(filePath)) return null;

    if (this.inMemoryCache.has(filePath))
      return this.inMemoryCache.get(filePath)!;

    if (!this.ongoingFetchRequests.has(filePath)) {
      const request = this.fetchAndProcessAudio(filePath);
      this.ongoingFetchRequests.set(filePath, request);
    }

    try {
      const buffer = await this.ongoingFetchRequests.get(filePath)!;
      this.ongoingFetchRequests.delete(filePath);
      if (buffer === null) {
        this.notFoundFiles.add(filePath);
        if (!this.audioGenerationQueue.has(filePath)) {
          this.requestAudioGeneration(filePath);
        }
      }
      return buffer;
    } catch (error) {
      log(LogLevel.ERROR, "Error fetching or processing audio:", error);
      this.notFoundFiles.add(filePath);
      if (!this.audioGenerationQueue.has(filePath)) {
        this.requestAudioGeneration(filePath);
      }
      return null;
    }
  }

  clearCache(): void {
    this.inMemoryCache.clear();
    this.ongoingFetchRequests.clear();
    this.notFoundFiles.clear();
    this.audioGenerationQueue.clear();
  }

  private async checkFileExistsInBackend(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "checkAudioFileExists", filePath },
        (response) => resolve(response.exists)
      );
    });
  }

  private async fetchAndProcessAudio(
    filePath: string
  ): Promise<AudioBuffer | null> {
    try {
      let audioData = await this.audioCache.getAudio(filePath);

      if (!audioData) {
        audioData = await this.fetchAudioFile(filePath);
        if (!audioData) {
          return null;
        }
        await this.audioCache.storeAudio(filePath, audioData);
      }

      try {
        const buffer = await this.audioContext.decodeAudioData(
          audioData.slice(0)
        );
        this.inMemoryCache.set(filePath, buffer);
        return buffer;
      } catch (e) {
        log(LogLevel.ERROR, "Error decoding audio data:", e);
        return null;
      }
    } catch (error) {
      log(LogLevel.ERROR, "Error fetching audio:", error);
      return null;
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

  private async requestAudioGeneration(filePath: string): Promise<void> {
    if (this.audioGenerationQueue.has(filePath)) return;
    this.audioGenerationQueue.add(filePath);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "generateAudio", filePath }, () => {
        this.audioGenerationQueue.delete(filePath);
        this.notFoundFiles.delete(filePath); // Remove from notFoundFiles when generation is complete
        resolve();
      });
    });
  }
}
