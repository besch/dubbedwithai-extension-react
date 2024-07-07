export interface DubbingConfig {
  defaultVolume: number;
  dubbingVolume: number;
  preloadTime: number;
  subtitleUpdateInterval: number;
}

export interface Subtitle {
  start: string;
  end: string;
  text: string;
}

export interface DubbingConfig {
  defaultVolume: number;
  dubbingVolume: number;
  preloadTime: number;
  subtitleUpdateInterval: number;
}

export type DubbingMessage =
  | { action: "initializeDubbing"; movieId: string; subtitleId: string }
  | { action: "stopDubbing" }
  | { action: "checkDubbingStatus" }
  | { action: "updateDubbingState"; payload: boolean };
