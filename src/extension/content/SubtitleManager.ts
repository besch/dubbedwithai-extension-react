import { Subtitle } from "./types";
import { timeStringToSeconds } from "./utils";

export class SubtitleManager {
  private subtitlesCache: Map<string, Subtitle[]> = new Map();
  private subtitleRequests: Map<string, Promise<Subtitle[] | null>> = new Map();
  private sortedSubtitles: Subtitle[] = [];

  getUpcomingSubtitles(currentTime: number, preloadTime: number): Subtitle[] {
    return this.sortedSubtitles.filter((subtitle) => {
      const startTime = timeStringToSeconds(subtitle.start);
      return startTime > currentTime && startTime <= currentTime + preloadTime;
    });
  }

  reset(): void {
    this.sortedSubtitles = [];
  }

  async getSubtitles(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    const cacheKey = `${movieId}-${subtitleId}`;

    if (this.subtitlesCache.has(cacheKey))
      return this.subtitlesCache.get(cacheKey)!;

    if (!this.subtitleRequests.has(cacheKey)) {
      const subtitlePromise = new Promise<Subtitle[] | null>((resolve) => {
        chrome.runtime.sendMessage(
          { action: "requestSubtitles", movieId, subtitleId },
          (response: any) => {
            if (response?.action === "subtitlesData") {
              this.subtitlesCache.set(cacheKey, response.data);
              this.sortSubtitles(response.data);
              resolve(response.data);
            } else {
              resolve(null);
            }
          }
        );
      });

      this.subtitleRequests.set(cacheKey, subtitlePromise);
    }

    const subtitlePromise = this.subtitleRequests.get(cacheKey);
    this.subtitleRequests.delete(cacheKey);

    // Wait for the promise to resolve and return its result
    return subtitlePromise ? await subtitlePromise : null;
  }

  private sortSubtitles(subtitles: Subtitle[]): void {
    this.sortedSubtitles = [...subtitles].sort(
      (a, b) => timeStringToSeconds(a.start) - timeStringToSeconds(b.start)
    );
  }

  getCurrentSubtitles(currentTime: number): Subtitle[] {
    const index = this.sortedSubtitles.findIndex(
      (subtitle) => timeStringToSeconds(subtitle.end) > currentTime
    );
    if (index === -1) return [];

    return this.sortedSubtitles
      .slice(index)
      .filter(
        (subtitle) =>
          timeStringToSeconds(subtitle.start) <= currentTime &&
          timeStringToSeconds(subtitle.end) > currentTime
      );
  }
}
