import { AudioCache } from "./AudioCache";
import { base64ToArrayBuffer, log, LogLevel } from "./utils";

export class AudioFileManager {
  private audioCache: AudioCache;
  private inMemoryCache: Map<string, AudioBuffer> = new Map();
  private ongoingRequests: Map<string, Promise<AudioBuffer | null>> = new Map();
  private requestedFiles: Set<string> = new Set();

  constructor(private audioContext: AudioContext) {
    this.audioCache = new AudioCache();
  }

  async getAudioBuffer(
    movieId: string,
    subtitleId: string,
    fileName: string
  ): Promise<AudioBuffer | null> {
    const cacheKey = `${movieId}-${subtitleId}-${fileName}`;

    if (this.requestedFiles.has(cacheKey)) {
      while (
        this.ongoingRequests.has(cacheKey) ||
        !this.inMemoryCache.has(cacheKey)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.inMemoryCache.get(cacheKey) || null;
    }

    this.requestedFiles.add(cacheKey);

    try {
      if (this.inMemoryCache.has(cacheKey))
        return this.inMemoryCache.get(cacheKey)!;
      if (this.ongoingRequests.has(cacheKey))
        return this.ongoingRequests.get(cacheKey)!;

      const cachedAudio = await this.audioCache.getAudio(cacheKey);
      if (cachedAudio) {
        try {
          const buffer = await this.audioContext.decodeAudioData(
            cachedAudio.slice(0)
          );
          this.inMemoryCache.set(cacheKey, buffer);
          return buffer;
        } catch (e) {
          log(LogLevel.ERROR, "Error decoding cached audio data:", e);
        }
      }

      const request = this.fetchAndProcessAudio(
        movieId,
        subtitleId,
        fileName,
        cacheKey
      );
      this.ongoingRequests.set(cacheKey, request);
      return await request;
    } finally {
      this.ongoingRequests.delete(cacheKey);
    }
  }

  private async fetchAndProcessAudio(
    movieId: string,
    subtitleId: string,
    fileName: string,
    cacheKey: string
  ): Promise<AudioBuffer | null> {
    try {
      const audioData = await this.fetchAudioFile(
        movieId,
        subtitleId,
        fileName
      );
      if (!audioData) return null;

      const buffer = await this.audioContext.decodeAudioData(
        audioData.slice(0)
      );
      this.inMemoryCache.set(cacheKey, buffer);
      await this.audioCache.storeAudio(cacheKey, audioData);
      return buffer;
    } catch (e) {
      log(LogLevel.ERROR, "Error fetching or processing audio:", e);
      return null;
    }
  }

  private fetchAudioFile(
    movieId: string,
    subtitleId: string,
    fileName: string
  ): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "requestAudioFile", movieId, subtitleId, fileName },
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

  clearCache(): void {
    this.inMemoryCache.clear();
    this.ongoingRequests.clear();
    this.requestedFiles.clear();
  }
}
