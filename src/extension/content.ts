import { DubbingManager } from "./content/DubbingManager";
import { DubbingConfig } from "./content/types";
import { log, LogLevel } from "./content/utils";

const config: DubbingConfig = {
  defaultVolume: 1,
  dubbingVolume: 0.3,
  preloadTime: 5,
  subtitleUpdateInterval: 0.5,
};

const dubbingManager = new DubbingManager(config);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "initializeDubbing":
      dubbingManager.initialize(message.movieId, message.subtitleId);
      break;
    case "stopDubbing":
      dubbingManager.stop();
      break;
    // Add more cases as needed
  }
});

log(LogLevel.INFO, "Content script loaded and DubbingManager initialized");

chrome.storage.local.get(
  ["isDubbingActive", "currentMovieId", "currentSubtitleId"],
  (result) => {
    if (
      result.isDubbingActive &&
      result.currentMovieId &&
      result.currentSubtitleId
    ) {
      dubbingManager.initialize(
        result.currentMovieId,
        result.currentSubtitleId
      );
    }
  }
);

(window as any).dubbingManager = dubbingManager;
