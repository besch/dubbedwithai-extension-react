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

  public setActiveSubtitles(subtitles: Subtitle[]): void {
    const uniqueId = this.generateUniqueId();
    this.sortedSubtitles = subtitles.map((subtitle) => ({
      ...subtitle,
      uniqueId,
    }));
    this.sortedSubtitles.sort((a, b) => a.start - b.start);
  }

  async getSubtitles(
    movieId: string,
    languageCode: string,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<Subtitle[] | null> {
    const cacheKey = this.getCacheKey(
      movieId,
      languageCode,
      seasonNumber,
      episodeNumber
    );

    if (this.subtitlesCache.has(cacheKey)) {
      return this.subtitlesCache.get(cacheKey)!;
    }

    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }

    const subtitlesPromise = this.fetchSubtitles(
      movieId,
      languageCode,
      seasonNumber,
      episodeNumber
    );
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
    languageCode: string,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<Subtitle[] | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "requestSubtitles",
          movieId,
          languageCode,
          seasonNumber,
          episodeNumber,
        },
        async (response: any) => {
          if (response?.action === "subtitlesData" && response.data) {
            resolve(response.data);
          } else {
            // If subtitles are not available, try fetching from Google Storage
            const googleStorageSubtitles = await this.fetchFromGoogleStorage(
              movieId,
              languageCode,
              seasonNumber,
              episodeNumber
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
    languageCode: string,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<Subtitle[] | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "fetchSubtitlesFromGoogleStorage",
          movieId,
          languageCode,
          seasonNumber,
          episodeNumber,
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
    languageCode: string,
    subtitles: Subtitle[],
    seasonNumber?: number,
    episodeNumber?: number
  ): void {
    const cacheKey = this.getCacheKey(
      movieId,
      languageCode,
      seasonNumber,
      episodeNumber
    );
    this.subtitlesCache.set(cacheKey, subtitles);
    this.sortSubtitles(subtitles);
  }

  private getCacheKey(
    movieId: string,
    languageCode: string,
    seasonNumber?: number,
    episodeNumber?: number
  ): string {
    if (seasonNumber !== undefined && episodeNumber !== undefined) {
      return `${movieId}-${languageCode}-S${seasonNumber}E${episodeNumber}`;
    }
    return `${movieId}-${languageCode}`;
  }

  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
