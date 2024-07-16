import { Subtitle } from "./types";

export class SubtitleManager {
  private subtitlesCache: Map<string, Subtitle[]> = new Map();
  private subtitleRequests: Map<string, Promise<Subtitle[] | null>> = new Map();
  private sortedSubtitles: Subtitle[] = [];

  async getSubtitles(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    const cacheKey = `${movieId}-${subtitleId}`;

    if (this.subtitlesCache.has(cacheKey)) {
      return this.subtitlesCache.get(cacheKey)!;
    }

    if (!this.subtitleRequests.has(cacheKey)) {
      const subtitlePromise = this.fetchSubtitles(movieId, subtitleId);
      this.subtitleRequests.set(cacheKey, subtitlePromise);
    }

    const subtitlePromise = this.subtitleRequests.get(cacheKey);
    this.subtitleRequests.delete(cacheKey);

    const subtitles = await (subtitlePromise ?? Promise.resolve(null));

    // If subtitles were successfully fetched, cache them
    if (subtitles) {
      this.subtitlesCache.set(cacheKey, subtitles);
      this.sortSubtitles(subtitles);
    }

    return subtitles;
  }

  getUpcomingSubtitles(adjustedTime: number, preloadTime: number): Subtitle[] {
    return this.sortedSubtitles.filter((subtitle) => {
      return (
        subtitle.start > adjustedTime &&
        subtitle.start <= adjustedTime + preloadTime * 1000
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
