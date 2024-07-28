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
      subtitleId: string;
      srtContent?: string;
    }
  | { action: "playDubbing" }
  | { action: "pauseDubbing" }
  | { action: "stopDubbing" }
  | { action: "checkDubbingStatus" }
  | { action: "updateDubbingState"; payload: boolean }
  | { action: "setDubbingVolumeMultiplier"; payload: number }
  | { action: "setVideoVolumeWhilePlayingDubbing"; payload: number };

export interface StorageData {
  isDubbingActive?: boolean;
  currentMovieId?: string;
  currentSubtitleId?: string;
}
