import { Subtitle } from "./types";

export class SubtitleManager {
  private static instance: SubtitleManager | null = null;
  private subtitlesCache: Map<string, Subtitle[]> = new Map();
  private sortedSubtitles: Subtitle[] = [];
  private pendingRequests: Map<string, Promise<Subtitle[] | null>> = new Map();

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

    const subtitlesPromise = new Promise<Subtitle[] | null>((resolve) => {
      chrome.runtime.sendMessage(
        { action: "requestSubtitles", movieId, subtitleId },
        (response: any) => {
          if (response?.action === "subtitlesData") {
            resolve(response.data);
          } else {
            resolve(null);
          }
        }
      );
    });

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
        (response: any) => {
          if (response?.action === "subtitlesData") {
            resolve(response.data);
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
}
