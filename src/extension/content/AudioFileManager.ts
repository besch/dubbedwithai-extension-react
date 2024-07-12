import { AudioCache } from "./AudioCache";
import { base64ToArrayBuffer, log, LogLevel } from "./utils";

export class AudioFileManager {
  private audioCache: AudioCache;
  private inMemoryCache: Map<string, AudioBuffer> = new Map();
  private ongoingRequests: Map<string, Promise<AudioBuffer | null>> = new Map();
  private notFoundFiles: Set<string> = new Set();

  constructor(private audioContext: AudioContext) {
    this.audioCache = new AudioCache();
  }

  async getAudioBuffer(
    movieId: string,
    subtitleId: string,
    fileName: string
  ): Promise<AudioBuffer | null> {
    const cacheKey = `${movieId}-${subtitleId}-${fileName}`;

    if (this.notFoundFiles.has(cacheKey)) {
      return null;
    }

    if (this.inMemoryCache.has(cacheKey)) {
      return this.inMemoryCache.get(cacheKey)!;
    }

    if (!this.ongoingRequests.has(cacheKey)) {
      const request = this.fetchAndProcessAudio(
        movieId,
        subtitleId,
        fileName,
        cacheKey
      );
      this.ongoingRequests.set(cacheKey, request);
    }

    try {
      const buffer = await this.ongoingRequests.get(cacheKey)!;
      this.ongoingRequests.delete(cacheKey);
      if (buffer === null) {
        this.notFoundFiles.add(cacheKey);
      }
      return buffer;
    } catch (error) {
      log(LogLevel.ERROR, "Error fetching or processing audio:", error);
      this.notFoundFiles.add(cacheKey);
      return null;
    }
  }

  private async fetchAndProcessAudio(
    movieId: string,
    subtitleId: string,
    fileName: string,
    cacheKey: string
  ): Promise<AudioBuffer | null> {
    let audioData = await this.audioCache.getAudio(cacheKey);

    if (!audioData) {
      audioData = await this.fetchAudioFile(movieId, subtitleId, fileName);
      if (!audioData) {
        this.notFoundFiles.add(cacheKey);
        return null;
      }
      await this.audioCache.storeAudio(cacheKey, audioData);
    }

    try {
      const buffer = await this.audioContext.decodeAudioData(
        audioData.slice(0)
      );
      this.inMemoryCache.set(cacheKey, buffer);
      return buffer;
    } catch (e) {
      log(LogLevel.ERROR, "Error decoding audio data:", e);
      this.notFoundFiles.add(cacheKey);
      return null;
    }
  }

  private async fetchAudioFile(
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
    this.notFoundFiles.clear();
  }
}
