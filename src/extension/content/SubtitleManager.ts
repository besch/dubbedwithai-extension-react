import { Subtitle } from "@/types";

export class SubtitleManager {
  private static instance: SubtitleManager | null = null;
  private sortedSubtitles: Subtitle[] = [];

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

  public getActiveSubtitles(): Subtitle[] {
    return this.sortedSubtitles;
  }

  public async getSubtitles(
    movieId: string,
    languageCode: string,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<Subtitle[] | null> {
    const subtitles = await this.fetchSubtitles(
      movieId,
      languageCode,
      seasonNumber,
      episodeNumber
    );
    if (subtitles) {
      this.setActiveSubtitles(subtitles);
    }
    return subtitles;
  }

  public getUpcomingSubtitles(
    adjustedTimeMs: number,
    preloadTimeMs: number
  ): Subtitle[] {
    return this.sortedSubtitles.filter((subtitle) => {
      return (
        subtitle.start > adjustedTimeMs &&
        subtitle.start <= adjustedTimeMs + preloadTimeMs
      );
    });
  }

  public getCurrentSubtitles(adjustedTimeMs: number): Subtitle[] {
    return this.sortedSubtitles.filter((subtitle) => {
      return adjustedTimeMs >= subtitle.start && adjustedTimeMs < subtitle.end;
    });
  }

  public reset(): void {
    this.sortedSubtitles = [];
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
        (response: any) => {
          if (response?.action === "subtitlesData" && response.data) {
            resolve(response.data);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  public adjustSubtitlesByOffset(offset: number): void {
    this.sortedSubtitles = this.sortedSubtitles.map((subtitle) => ({
      ...subtitle,
      start: subtitle.start + offset,
      end: subtitle.end + offset,
    }));
  }
}
