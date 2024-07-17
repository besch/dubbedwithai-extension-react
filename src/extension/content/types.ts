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
  | { action: "initializeDubbing"; movieId: string; subtitleId: string }
  | { action: "stopDubbing" }
  | { action: "checkDubbingStatus" }
  | { action: "updateDubbingState"; payload: boolean };
