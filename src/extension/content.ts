import { DubbingManager } from "./content/DubbingManager";
import { DubbingConfig, DubbingMessage } from "./content/types";
import { log, LogLevel } from "./content/utils";

const config: DubbingConfig = {
  defaultVolume: 1,
  dubbingVolume: 0.3,
  preloadTime: 5000, // 5 seconds
  preloadAudioGenerationTime: 15000, //15 seconds
  subtitleUpdateInterval: 0.5,
};

class ContentScript {
  private dubbingManager: DubbingManager;
  private isDubbingActive = false;

  constructor() {
    this.dubbingManager = DubbingManager.getInstance(config);
    this.setupMessageListener();
    this.initializeFromStorage();
    this.setupVisibilityChangeListener();
  }

  private checkForVideoElement(): boolean {
    return !!document.querySelector("video");
  }

  private async stopDubbingOnInactiveTab() {
    if (this.isDubbingActive && this.dubbingManager) {
      await this.dubbingManager.stop();
      this.updateDubbingState(false);
    }
  }

  private updateDubbingState(isActive: boolean) {
    this.isDubbingActive = isActive;
    chrome.storage.local.set({ isDubbingActive: isActive });
    chrome.runtime.sendMessage({
      action: "updateDubbingState",
      payload: isActive,
    });
  }

  private async handleDubbingAction(message: DubbingMessage): Promise<any> {
    switch (message.action) {
      case "initializeDubbing":
        return this.handleInitializeDubbing(message);
      case "stopDubbing":
        return this.handleStopDubbing();
      case "checkDubbingStatus":
        return this.handleCheckDubbingStatus();
      case "updateDubbingState":
        return this.handleUpdateDubbingState(message);
      default:
        throw new Error(`Unknown action: ${(message as any).action}`);
    }
  }

  private async handleInitializeDubbing(message: DubbingMessage): Promise<any> {
    if (!this.checkForVideoElement()) {
      throw new Error("No video element found on the page");
    }
    if ("movieId" in message && "subtitleId" in message) {
      if (this.isDubbingActive) {
        // If dubbing is already active for the same movie and subtitle, just resume
        if (
          this.dubbingManager.isCurrentDubbing(
            message.movieId,
            message.subtitleId
          )
        ) {
          console.log("startDubbing");
          this.dubbingManager.startDubbing();
          return { status: "resumed" };
        }
      }
      this.dubbingManager.initialize(message.movieId, message.subtitleId);
      this.updateDubbingState(true);
      await chrome.storage.local.set({
        currentMovieId: message.movieId,
        currentSubtitleId: message.subtitleId,
      });
      return { status: "initialized" };
    } else {
      throw new Error("Missing movieId or subtitleId");
    }
  }

  private async handleStopDubbing(): Promise<any> {
    if (this.isDubbingActive) {
      this.dubbingManager.stop();
      this.updateDubbingState(false);
      return { status: "stopped" };
    }
    return { status: "already_stopped" };
  }

  private handleCheckDubbingStatus(): any {
    return {
      status: "checked",
      isDubbingActive: this.isDubbingActive,
    };
  }

  private handleUpdateDubbingState(message: DubbingMessage): any {
    if ("payload" in message && typeof message.payload === "boolean") {
      this.updateDubbingState(message.payload);
      return { status: "updated" };
    } else {
      throw new Error("Invalid payload for updateDubbingState");
    }
  }

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener(
      (message: DubbingMessage, sender, sendResponse) => {
        if (message.action === "checkDubbingStatus") {
          sendResponse({ isDubbingActive: this.isDubbingActive });
          return true;
        }

        this.handleDubbingAction(message)
          .then((response) => {
            sendResponse(response);
          })
          .catch((error) => {
            log(LogLevel.ERROR, "Error in dubbing action:", error);
            sendResponse({ status: "error", message: error.message });
          });
        return true;
      }
    );
  }

  private async initializeFromStorage() {
    const result = await chrome.storage.local.get([
      "isDubbingActive",
      "currentMovieId",
      "currentSubtitleId",
    ]);

    if (
      result.isDubbingActive &&
      result.currentMovieId &&
      result.currentSubtitleId
    ) {
      try {
        // Check for video element
        if (!this.checkForVideoElement()) {
          throw new Error("No video element found on the page");
        }

        // Initialize dubbing
        this.dubbingManager.initialize(
          result.currentMovieId,
          result.currentSubtitleId
        );

        // Update dubbing state
        this.updateDubbingState(true);

        log(LogLevel.INFO, "Dubbing initialized from storage successfully");
      } catch (error) {
        log(
          LogLevel.ERROR,
          "Failed to initialize dubbing from storage:",
          error
        );
        this.updateDubbingState(false);
      }
    } else if (result.isDubbingActive) {
      // If isDubbingActive is true but we don't have all necessary data,
      // update the state to false
      this.updateDubbingState(false);
      log(LogLevel.WARN, "Dubbing was active but missing necessary data");
    } else {
      log(LogLevel.INFO, "No active dubbing session found in storage");
    }
  }

  private setupVisibilityChangeListener() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stopDubbingOnInactiveTab();
      }
    });
  }
}

const contentScript = new ContentScript();
(window as any).dubbingManager = contentScript;

log(LogLevel.INFO, "Content script loaded");
