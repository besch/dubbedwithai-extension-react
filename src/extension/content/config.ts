import { DubbingVoice } from "@/types";

export interface Config {
  videoVolumeWhilePlayingDubbing: number; // in %
  maxDubbingVolumeMultiplier: number;
  preloadAudioGenerationTime: number; // in milliseconds
  audioFileFetchCacheTimeout: number; // in milliseconds
  videoTimeUpdateInterval: number; // in milliseconds
  defaultVoice: DubbingVoice;
}

const config: Config = {
  videoVolumeWhilePlayingDubbing: 0.3,
  maxDubbingVolumeMultiplier: 2.0,
  preloadAudioGenerationTime: 15000,
  audioFileFetchCacheTimeout: 5 * 60 * 1000,
  videoTimeUpdateInterval: 100,
  defaultVoice: "nova",
};

export default config;
