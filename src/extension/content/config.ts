export interface Config {
  videoVolumeWhilePlayingDubbing: number;
  maxDubbingVolumeMultiplier: number;
  preloadAudioTime: number; // in milliseconds
  preloadAudioGenerationTime: number; // in milliseconds
  subtitleUpdateInterval: number; // in seconds
  audioFileExistenceCacheTimeout: number; // in milliseconds
  audioFileGenerationCacheTimeout: number; // in milliseconds
  precisionTimerUpdateInterval: number; // in milliseconds
  precisionTimerSignificantChangeThreshold: number; // in milliseconds
  subtitleFadeOutDuration: number; // in seconds
  subtitleFadeOutVolume: number; // final volume as a percentage (0-1)
}

const config: Config = {
  videoVolumeWhilePlayingDubbing: 0.3,
  maxDubbingVolumeMultiplier: 2.0,
  preloadAudioTime: 5000,
  preloadAudioGenerationTime: 15000,
  subtitleUpdateInterval: 0.5,
  audioFileExistenceCacheTimeout: 60000,
  audioFileGenerationCacheTimeout: 300000,
  precisionTimerUpdateInterval: 50,
  precisionTimerSignificantChangeThreshold: 0.1,
  subtitleFadeOutDuration: 0.3, // 300 milliseconds fade-out duration
  subtitleFadeOutVolume: 0.7, // Fade out to 70% of the original volume
};

export default config;
