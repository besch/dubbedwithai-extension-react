import { Subtitle } from "./types";

export class SubtitleManager {
  private static instance: SubtitleManager | null = null;
  private subtitlesCache: Map<string, Subtitle[]> = new Map();
  private subtitleRequests: Map<string, Promise<Subtitle[] | null>> = new Map();
  private sortedSubtitles: Subtitle[] = [];

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

    if (!this.subtitlesCache.has(cacheKey)) {
      const subtitles = await this.fetchSubtitles(movieId, subtitleId);
      if (subtitles) {
        this.subtitlesCache.set(cacheKey, subtitles);
        this.sortSubtitles(subtitles);
      }
      return subtitles;
    }

    return this.subtitlesCache.get(cacheKey)!;
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
            this.subtitlesCache.set(`${movieId}-${subtitleId}`, response.data);
            this.sortSubtitles(response.data);
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
