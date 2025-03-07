import { AudioCache } from "./AudioCache";
import config from "./config";
import { base64ToArrayBuffer } from "../utils";

export class AudioFileManager {
  private audioCache: AudioCache;
  private inMemoryCache: Map<string, AudioBuffer> = new Map();
  private notFoundFiles: Set<string> = new Set();
  private lastFetchAttempt: Map<string, number> = new Map();

  constructor(private audioContext: AudioContext) {
    this.audioCache = new AudioCache();
  }

  public async getAudioBuffer(
    filePath: string,
    text: string
  ): Promise<AudioBuffer | null> {
    if (this.notFoundFiles.has(filePath)) {
      return null;
    }

    if (this.inMemoryCache.has(filePath)) {
      return this.inMemoryCache.get(filePath)!;
    }

    const cachedArrayBuffer = await this.audioCache.getAudio(filePath);
    if (cachedArrayBuffer) {
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(
          cachedArrayBuffer.slice(0)
        );
        this.inMemoryCache.set(filePath, audioBuffer);
        return audioBuffer;
      } catch (error) {
        console.error(
          `Failed to decode cached audio data for ${filePath}:`,
          error
        );
      }
    }

    return this.fetchAndProcessAudio(filePath, text);
  }

  clearCache(): void {
    this.inMemoryCache.clear();
    this.notFoundFiles.clear();
    this.lastFetchAttempt.clear();
  }

  stop(): void {
    this.clearCache();
  }

  private async fetchAndProcessAudio(
    filePath: string,
    text: string
  ): Promise<AudioBuffer | null> {
    try {
      const arrayBuffer = await this.fetchAudioFile(filePath, text);
      if (!arrayBuffer) {
        this.notFoundFiles.add(filePath);
        return null;
      }

      const audioBuffer = await this.audioContext.decodeAudioData(
        arrayBuffer.slice(0)
      );
      this.inMemoryCache.set(filePath, audioBuffer);
      await this.audioCache.storeAudio(filePath, arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error("Error fetching or processing audio:", error);
      return null;
    }
  }

  public async fetchAudioFile(
    filePath: string,
    text: string
  ): Promise<ArrayBuffer | null> {
    const now = Date.now();
    const lastAttempt = this.lastFetchAttempt.get(filePath) || 0;

    if (now - lastAttempt < config.audioFileFetchCacheTimeout) {
      return null;
    }

    const fetchPromise = new Promise<ArrayBuffer | null>((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: "fetchAudioFile", filePath, text },
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
      console.error("Error fetching or generating audio:", error);
      return null;
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
