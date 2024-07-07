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

async function stopDubbingOnInactiveTab() {
  if (isDubbingActive && dubbingManager) {
    await dubbingManager.stop();
    updateDubbingState(false);
  }
}

function updateDubbingState(isActive: boolean) {
  isDubbingActive = isActive;
  chrome.storage.local.set({ isDubbingActive: isActive });
  chrome.runtime.sendMessage({
    action: "updateDubbingState",
    payload: isActive,
  });
}

async function handleDubbingAction(message: DubbingMessage): Promise<any> {
  console.log("Handling dubbing action:", message.action);

  switch (message.action) {
    case "initializeDubbing":
      if (!initializeDubbingManager()) {
        throw new Error("No video element found on the page");
      }
      if ("movieId" in message && "subtitleId" in message) {
        await dubbingManager!.initialize(message.movieId, message.subtitleId);
        updateDubbingState(true);
        await chrome.storage.local.set({
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
      updateDubbingState(false);
      return { status: "stopped" };
    case "checkDubbingStatus":
      if (!initializeDubbingManager()) {
        throw new Error("No video element found on the page");
      }
      return {
        status: "checked",
        isDubbingActive: isDubbingActive,
      };
    case "updateDubbingState":
      if ("payload" in message && typeof message.payload === "boolean") {
        updateDubbingState(message.payload);
        return { status: "updated" };
      } else {
        throw new Error("Invalid payload for updateDubbingState");
      }
    default:
      console.error(`Unknown action received: ${(message as any).action}`);
      throw new Error(`Unknown action: ${(message as any).action}`);
  }
}

chrome.runtime.onMessage.addListener(
  (message: DubbingMessage, sender, sendResponse) => {
    console.log("Received message in content script:", message);

    if (message.action === "checkDubbingStatus") {
      sendResponse({ isDubbingActive: isDubbingActive });
      return true;
    }

    handleDubbingAction(message)
      .then((response) => {
        console.log("Sending response from content script:", response);
        sendResponse(response);
      })
      .catch((error) => {
        console.error("Error in dubbing action:", error);
        sendResponse({ status: "error", message: error.message });
      });
    return true;
  }
);

log(LogLevel.INFO, "Content script loaded");

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
        updateDubbingState(true);
      } catch (error) {
        console.error("Failed to initialize dubbing:", error);
        updateDubbingState(false);
      }
    } else if (result.isDubbingActive) {
      // If dubbing was active but we can't initialize it on this page, update the state
      updateDubbingState(false);
    }
  }
);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopDubbingOnInactiveTab();
  }
});

(window as any).dubbingManager = dubbingManager;
