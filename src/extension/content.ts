// content.ts
import { DubbingManager } from "./content/DubbingManager";
import { DubbingConfig, DubbingMessage } from "./content/types";
import { log, LogLevel } from "./content/utils";

const config: DubbingConfig = {
  defaultVolume: 1,
  dubbingVolume: 0.3,
  preloadTime: 5,
  subtitleUpdateInterval: 0.5,
};

const dubbingManager = new DubbingManager(config);
let isDubbingActive = false;

chrome.runtime.onMessage.addListener(
  (message: DubbingMessage, sender, sendResponse) => {
    switch (message.action) {
      case "initializeDubbing":
        if ("movieId" in message && "subtitleId" in message) {
          dubbingManager.initialize(message.movieId, message.subtitleId);
          isDubbingActive = true;
          chrome.storage.local.set({
            isDubbingActive: true,
            currentMovieId: message.movieId,
            currentSubtitleId: message.subtitleId,
          });
          sendResponse({ status: "initialized" });
        } else {
          sendResponse({
            status: "error",
            message: "Missing movieId or subtitleId",
          });
        }
        break;
      case "stopDubbing":
        dubbingManager.stop();
        isDubbingActive = false;
        chrome.storage.local.set({ isDubbingActive: false });
        sendResponse({ status: "stopped" });
        break;
      case "checkDubbingStatus":
        sendResponse({
          status: "checked",
          isDubbingActive: isDubbingActive,
        });
        break;
    }
    return true;
  }
);

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
      isDubbingActive = true;
    }
  }
);

(window as any).dubbingManager = dubbingManager;
