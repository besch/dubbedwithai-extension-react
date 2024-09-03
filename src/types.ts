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

export interface DubbingConfig {
  defaultVolume: number;
  dubbingVolume: number;
  preloadTime: number;
  preloadAudioGenerationTime: number;
  subtitleUpdateInterval: number;
}

export interface Subtitle {
  start: number;
  end: number;
  text: string;
}

export type DubbingMessage =
  | {
      action: "initializeDubbing";
      movieId: string;
      languageCode: string;
      srtContent: string | null;
      seasonNumber?: number;
      episodeNumber?: number;
    }
  | { action: "stopDubbing" }
  | { action: "toggleDubbing" }
  | { action: "checkDubbingStatus" }
  | { action: "updateDubbingState"; payload: boolean }
  | { action: "setDubbingVolumeMultiplier"; payload: number }
  | { action: "setVideoVolumeWhilePlayingDubbing"; payload: number };

export interface StorageData {
  isDubbingActive?: boolean;
  movieId?: string;
  languageCode?: string;
  srtContent?: string | null;
  seasonNumber?: number;
  episodeNumber?: number;
}
