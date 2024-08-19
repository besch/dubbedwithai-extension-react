import { DubbingManager } from "./content/DubbingManager";
import { DubbingMessage, StorageData } from "@/types";
import { log, LogLevel } from "./content/utils";

class ContentScript {
  private dubbingManager: DubbingManager;
  private isDubbingActive = false;

  constructor() {
    this.dubbingManager = DubbingManager.getInstance();
    this.initialize();
  }

  private initialize(): void {
    this.setupMessageListener();
    this.initializeFromStorage();
    this.setupVisibilityChangeListener();
    this.setupUnloadListener();
  }

  private setupUnloadListener(): void {
    window.addEventListener("beforeunload", this.handlePageUnload);
  }

  private handlePageUnload = async (): Promise<void> => {
    console.log("Page is unloading. Stopping dubbing.");
    await this.stopDubbing();
    await this.updateDubbingState(false);
  };

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private async handleMessage(
    message: DubbingMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<boolean> {
    if (message.action === "initializeDubbing") {
      await this.initializeDubbing(
        message.movieId,
        message.languageCode,
        message.srtContent,
        message.seasonNumber,
        message.episodeNumber
      );
      this.isDubbingActive = true;
      this.updateDubbingState(true);
      sendResponse({ status: "initialized" });
      return true;
    }

    try {
      const response = await this.handleDubbingAction(message);
      sendResponse(response);
    } catch (error: unknown) {
      log(LogLevel.ERROR, "Error in dubbing action:", error);
      sendResponse({
        status: "error",
        message: this.getErrorMessage(error),
      });
    }

    return true;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private async handleDubbingAction(message: DubbingMessage): Promise<any> {
    switch (message.action) {
      case "initializeDubbing":
        return this.initializeDubbing(
          message.movieId,
          message.languageCode,
          message.srtContent,
          message.seasonNumber,
          message.episodeNumber
        );
      case "stopDubbing":
        return this.stopDubbing();
      case "updateDubbingState":
        return this.updateDubbingState(message.payload as boolean);
      case "setVideoVolumeWhilePlayingDubbing":
        return this.setVideoVolumeWhilePlayingDubbing(message.payload);
      default:
        return console.error(`Unknown action: ${message.action}`);
    }
  }

  private async setVideoVolumeWhilePlayingDubbing(
    volume: number
  ): Promise<any> {
    this.dubbingManager.setVideoVolumeWhilePlayingDubbing(volume);
    return { status: "updated" };
  }

  private async initializeDubbing(
    movieId?: string,
    languageCode?: string,
    srtContent?: string | null,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<any> {
    if (!this.checkForVideoElement()) {
      return console.error("No video element found on the page");
    }

    if (!movieId || !languageCode) {
      return console.error("Missing movieId or languageCode");
    }

    try {
      await this.dubbingManager.initialize(
        movieId,
        languageCode,
        srtContent,
        seasonNumber,
        episodeNumber
      );
      await this.updateDubbingState(true);
      await this.updateStorage({
        movieId,
        languageCode,
        srtContent,
        seasonNumber,
        episodeNumber,
      });
      return { status: "initialized" };
    } catch (error) {
      console.error("Failed to initialize dubbing:", error);
      await this.updateDubbingState(false);
      return this.formatError(error);
    }
  }

  private async stopDubbing(): Promise<any> {
    try {
      await this.dubbingManager.stop();
      await this.updateDubbingState(false);
      return { status: "stopped" };
    } catch (error) {
      console.error("Error stopping dubbing:", error);
      return this.formatError(error);
    }
  }

  private async updateDubbingState(isActive: boolean): Promise<any> {
    this.isDubbingActive = isActive;
    await chrome.storage.local.set({ isDubbingActive: isActive });
    chrome.runtime.sendMessage({
      action: "updateDubbingState",
      payload: isActive,
    });
    return { status: "updated" };
  }

  private async initializeFromStorage(): Promise<void> {
    const storage = (await chrome.storage.local.get([
      "isDubbingActive",
      "currentMovieId",
      "currentLanguageCode",
      "srtContent",
    ])) as StorageData;

    if (
      storage.isDubbingActive &&
      storage.currentMovieId &&
      storage.currentLanguageCode
    ) {
      try {
        if (!this.checkForVideoElement()) {
          return console.error("No video element found on the page");
        }

        await this.dubbingManager.initialize(
          storage.currentMovieId,
          storage.currentLanguageCode,
          storage.srtContent,
          storage.seasonNumber,
          storage.episodeNumber
        );
        await this.updateDubbingState(true);
        log(LogLevel.INFO, "Dubbing initialized from storage successfully");
      } catch (error) {
        log(
          LogLevel.ERROR,
          "Failed to initialize dubbing from storage:",
          error
        );
        await this.updateDubbingState(false);
      }
    } else if (storage.isDubbingActive) {
      await this.updateDubbingState(false);
      log(LogLevel.WARN, "Dubbing was active but missing necessary data");
    } else {
      log(LogLevel.INFO, "No active dubbing session found in storage");
    }
  }

  private setupVisibilityChangeListener(): void {
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
  }

  private async handleVisibilityChange(): Promise<void> {
    if (document.hidden && this.isDubbingActive) {
      console.log("Tab became hidden. Stopping dubbing.");
      await this.stopDubbing();
      await this.updateDubbingState(false);
    }
  }

  private checkForVideoElement(): boolean {
    return !!document.querySelector("video");
  }

  private async updateStorage(data: {
    movieId?: string;
    languageCode?: string;
    srtContent?: string | null;
    seasonNumber?: number;
    episodeNumber?: number;
  }): Promise<void> {
    const storage: StorageData = {};
    if (data.movieId) storage.currentMovieId = data.movieId;
    if (data.languageCode) storage.currentLanguageCode = data.languageCode;
    if (data.srtContent !== undefined) storage.srtContent = data.srtContent;
    if (data.seasonNumber !== undefined)
      storage.seasonNumber = data.seasonNumber;
    if (data.episodeNumber !== undefined)
      storage.episodeNumber = data.episodeNumber;

    await chrome.storage.local.set(storage);
  }

  private formatError(error: unknown): { status: string; message: string } {
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

const contentScript = new ContentScript();
(window as any).dubbingManager = contentScript;

log(LogLevel.INFO, "Content script loaded");

(window as any).__DUBBING_CONTENT_SCRIPT_LOADED__ = true;
