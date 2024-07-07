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

let dubbingManager: DubbingManager | null = null;
let isDubbingActive = false;

function initializeDubbingManager(): boolean {
  if (!document.querySelector("video")) {
    return false;
  }
  if (!dubbingManager) {
    dubbingManager = new DubbingManager(config);
  }
  return true;
}

async function handleDubbingAction(message: DubbingMessage): Promise<any> {
  switch (message.action) {
    case "initializeDubbing":
      if (!initializeDubbingManager()) {
        throw new Error("No video element found on the page");
      }
      if ("movieId" in message && "subtitleId" in message) {
        await dubbingManager!.initialize(message.movieId, message.subtitleId);
        isDubbingActive = true;
        await chrome.storage.local.set({
          isDubbingActive: true,
          currentMovieId: message.movieId,
          currentSubtitleId: message.subtitleId,
        });
        return { status: "initialized" };
      } else {
        throw new Error("Missing movieId or subtitleId");
      }
    case "stopDubbing":
      if (dubbingManager) {
        await dubbingManager.stop();
      }
      isDubbingActive = false;
      await chrome.storage.local.set({ isDubbingActive: false });
      return { status: "stopped" };
    case "checkDubbingStatus":
      if (!initializeDubbingManager()) {
        throw new Error("No video element found on the page");
      }
      return {
        status: "checked",
        isDubbingActive: isDubbingActive,
      };
    default:
      throw new Error(`Unknown action: ${(message as any).action}`);
  }
}

chrome.runtime.onMessage.addListener(
  (message: DubbingMessage, sender, sendResponse) => {
    handleDubbingAction(message)
      .then(sendResponse)
      .catch((error) => {
        console.error("Error in dubbing action:", error);
        sendResponse({ status: "error", message: error.message });
      });
    return true; // Indicates that the response is sent asynchronously
  }
);

log(LogLevel.INFO, "Content script loaded");

// ... rest of your content script ...

chrome.storage.local.get(
  ["isDubbingActive", "currentMovieId", "currentSubtitleId"],
  async (result) => {
    if (
      result.isDubbingActive &&
      result.currentMovieId &&
      result.currentSubtitleId &&
      initializeDubbingManager()
    ) {
      try {
        await dubbingManager!.initialize(
          result.currentMovieId,
          result.currentSubtitleId
        );
        isDubbingActive = true;
      } catch (error) {
        console.error("Failed to initialize dubbing:", error);
        isDubbingActive = false;
        await chrome.storage.local.set({ isDubbingActive: false });
        chrome.runtime.sendMessage({
          action: "updateDubbingState",
          payload: false,
        });
      }
    } else if (result.isDubbingActive) {
      // If dubbing was active but we can't initialize it on this page, update the state
      await chrome.storage.local.set({ isDubbingActive: false });
      chrome.runtime.sendMessage({
        action: "updateDubbingState",
        payload: false,
      });
    }
  }
);

// Listen for tab visibility changes
document.addEventListener("visibilitychange", async () => {
  if (document.hidden && isDubbingActive) {
    if (dubbingManager) {
      await dubbingManager.stop();
    }
    isDubbingActive = false;
    await chrome.storage.local.set({ isDubbingActive: false });
    chrome.runtime.sendMessage({
      action: "updateDubbingState",
      payload: false,
    });
  }
});

(window as any).dubbingManager = dubbingManager;
