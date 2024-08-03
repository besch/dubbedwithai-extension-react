// Define the interface for the config object
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
  minWordsPerSecond: number; // Minimum words per second for normal speech
}

// Create the config object that adheres to the Config interface
const config: Config = {
  videoVolumeWhilePlayingDubbing: 0.3,
  maxDubbingVolumeMultiplier: 2.0, // Allow up to 200% volume
  preloadAudioTime: 5000, // 5 seconds
  preloadAudioGenerationTime: 15000, // 15 seconds
  subtitleUpdateInterval: 0.5,
  audioFileExistenceCacheTimeout: 60000, // 1 minute cache timeout
  audioFileGenerationCacheTimeout: 300000, // 5 minutes cache timeout,
  precisionTimerUpdateInterval: 50, // Update every 50ms
  precisionTimerSignificantChangeThreshold: 0.1, // 100ms
  minWordsPerSecond: 2.5, // Minimum words per second for normal speech
};

export default config;
