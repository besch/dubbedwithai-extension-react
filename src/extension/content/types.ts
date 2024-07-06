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
