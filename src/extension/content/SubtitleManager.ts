import { Subtitle } from "@/types";

export class SubtitleManager {
  private static instance: SubtitleManager | null = null;
  private sortedSubtitles: Subtitle[] = [];

  public setActiveSubtitles(subtitles: Subtitle[]): void {
    if (!subtitles || subtitles.length === 0) {
      this.reset();
      return;
    }

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

  public getSubtitlesAroundTime(timeMs: number, count: number): Subtitle[] {
    if (!this.sortedSubtitles || this.sortedSubtitles.length === 0) {
      return [];
    }

    let index = this.sortedSubtitles.findIndex(
      (subtitle) => timeMs >= subtitle.start && timeMs < subtitle.end
    );

    if (index === -1) {
      // Handle timeMs before the first subtitle
      if (timeMs < this.sortedSubtitles[0].start) {
        index = 0;
      }
      // Handle timeMs after the last subtitle
      else if (
        timeMs >= this.sortedSubtitles[this.sortedSubtitles.length - 1].end
      ) {
        index = this.sortedSubtitles.length - 1;
      }
      // Handle timeMs between subtitles
      else {
        index = this.findNearestSubtitleIndex(timeMs);
      }
    }

    const halfCount = Math.floor(count / 2);
    const startIndex = Math.max(0, index - halfCount);
    const endIndex = Math.min(
      this.sortedSubtitles.length,
      index + halfCount + 1
    );

    return this.sortedSubtitles.slice(startIndex, endIndex);
  }

  private findNearestSubtitleIndex(timeMs: number): number {
    if (!this.sortedSubtitles || this.sortedSubtitles.length === 0) {
      return 0;
    }

    let nearestIndex = -1;
    let minDiff = Number.MAX_VALUE;

    for (let i = 0; i < this.sortedSubtitles.length; i++) {
      const subtitle = this.sortedSubtitles[i];
      const diff = Math.min(
        Math.abs(timeMs - subtitle.start),
        Math.abs(timeMs - subtitle.end)
      );

      if (diff < minDiff) {
        minDiff = diff;
        nearestIndex = i;
      }
    }

    return nearestIndex !== -1 ? nearestIndex : 0;
  }
}
