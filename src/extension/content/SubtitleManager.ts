import { Subtitle } from "@/types";

export class SubtitleManager {
  private static instance: SubtitleManager | null = null;
  private subtitlesCache: Map<string, Subtitle[]> = new Map();
  private sortedSubtitles: Subtitle[] = [];
  private pendingRequests: Map<string, Promise<Subtitle[] | null>> = new Map();

  private constructor() {}

  public static getInstance(): SubtitleManager {
    if (!SubtitleManager.instance) {
      SubtitleManager.instance = new SubtitleManager();
    }
    return SubtitleManager.instance;
  }

  async getSubtitles(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    const cacheKey = `${movieId}-${subtitleId}`;

    if (this.subtitlesCache.has(cacheKey)) {
      return this.subtitlesCache.get(cacheKey)!;
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const subtitlesPromise = this.fetchSubtitles(movieId, subtitleId);
    this.pendingRequests.set(cacheKey, subtitlesPromise);

    try {
      const subtitles = await subtitlesPromise;
      if (subtitles) {
        this.subtitlesCache.set(cacheKey, subtitles);
        this.sortSubtitles(subtitles);
      }
      return subtitles;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  getUpcomingSubtitles(adjustedTime: number, preloadTime: number): Subtitle[] {
    return this.sortedSubtitles.filter((subtitle) => {
      return (
        subtitle.start > adjustedTime &&
        subtitle.start <= adjustedTime + preloadTime
      );
    });
  }

  getCurrentSubtitles(adjustedTime: number): Subtitle[] {
    return this.sortedSubtitles.filter((subtitle) => {
      return adjustedTime >= subtitle.start && adjustedTime < subtitle.end;
    });
  }

  reset(): void {
    this.sortedSubtitles = [];
    this.subtitlesCache.clear();
  }

  private async fetchSubtitles(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "requestSubtitles", movieId, subtitleId },
        async (response: any) => {
          if (response?.action === "subtitlesData" && response.data) {
            resolve(response.data);
          } else {
            // If subtitles are not available, try fetching from Google Storage
            const googleStorageSubtitles = await this.fetchFromGoogleStorage(
              movieId,
              subtitleId
            );
            if (googleStorageSubtitles) {
              resolve(googleStorageSubtitles);
            } else {
              resolve(null);
            }
          }
        }
      );
    });
  }

  private async fetchFromGoogleStorage(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "fetchSubtitlesFromGoogleStorage",
          movieId,
          subtitleId,
        },
        (response: any) => {
          if (response && response.subtitles) {
            resolve(response.subtitles);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  private sortSubtitles(subtitles: Subtitle[]): void {
    this.sortedSubtitles = [...subtitles].sort((a, b) => a.start - b.start);
  }

  public cacheSubtitles(
    movieId: string,
    subtitleId: string,
    subtitles: Subtitle[]
  ): void {
    const cacheKey = `${movieId}-${subtitleId}`;
    this.subtitlesCache.set(cacheKey, subtitles);
    this.sortSubtitles(subtitles);
  }
}
