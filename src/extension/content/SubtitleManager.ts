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

  async getSubtitles(
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
            const googleStorageSubtitles = await this.fetchFromGoogleStorage(
              movieId,
              languageCode,
              seasonNumber,
              episodeNumber
            );
            resolve(googleStorageSubtitles);
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

  private generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
