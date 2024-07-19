// Define the interface for the config object
export interface Config {
  defaultVolume: number;
  dubbingVolume: number;
  preloadAudioTime: number; // in milliseconds
  preloadAudioGenerationTime: number; // in milliseconds
  subtitleUpdateInterval: number; // in seconds
  audioFileExistenceCacheTimeout: number; // in milliseconds
  audioFileGenerationCacheTimeout: number; // in milliseconds
  precisionTimerUpdateInterval: number; // in milliseconds
  precisionTimerSignificantChangeThreshold: number; // in milliseconds
}

// Create the config object that adheres to the Config interface
const config: Config = {
  defaultVolume: 1,
  dubbingVolume: 0.3,
  preloadAudioTime: 5000, // 5 seconds
  preloadAudioGenerationTime: 15000, // 15 seconds
  subtitleUpdateInterval: 0.5,
  audioFileExistenceCacheTimeout: 60000, // 1 minute cache timeout
  audioFileGenerationCacheTimeout: 300000, // 5 minutes cache timeout,
  precisionTimerUpdateInterval: 50, // Update every 50ms
  precisionTimerSignificantChangeThreshold: 0.1, // 100ms
};

export default config;
