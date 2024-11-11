export interface Movie {
  imdbID: string;
  Title: string;
  Year: string;
  Type: "movie" | "series";
  Poster: string;
}

export interface Language {
  id: string;
  attributes: {
    language: string;
    language_name: string;
    ratings?: number;
    download_count?: number;
    subtitle_id?: string;
    files?: Array<{
      file_id: string;
      format: string;
      download_count: number;
    }>;
  };
}

export interface Subtitle {
  start: number;
  end: number;
  text: string;
}

export type DubbingMessage =
  | {
      action: "initializeDubbing";
      movieId: string | null;
      languageCode: string | null;
      srtContent: string;
      seasonNumber?: number;
      episodeNumber?: number;
    }
  | { action: "stopDubbing" }
  | { action: "toggleDubbing" }
  | { action: "checkDubbingStatus" }
  | { action: "updateDubbingState"; payload: boolean }
  | {
      action: "applySettingsChanges";
      payload: {
        subtitleOffset: number;
        dubbingVolumeMultiplier: number;
        videoVolumeWhilePlayingDubbing: number;
        dubbingVoice: DubbingVoice;
      };
    };

export interface StorageData {
  isDubbingActive?: boolean;
  movieId?: string | null;
  languageCode?: string | null;
  srtContent: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export type DubbingVoice =
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer";

export interface SettingsPayload {
  subtitleOffset: number;
  dubbingVolumeMultiplier: number;
  videoVolumeWhilePlayingDubbing: number;
  dubbingVoice: DubbingVoice;
}
