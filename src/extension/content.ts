import { DubbingManager } from "./content/DubbingManager";
import { DubbingMessage, StorageData } from "@/types";

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
    try {
      const response = await this.processDubbingMessage(message);
      sendResponse(response);
    } catch (error: unknown) {
      console.error("Error in dubbing action:", error);
      sendResponse(this.formatError(error));
    }

    return true;
  }

  private async processDubbingMessage(message: DubbingMessage): Promise<any> {
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
        return this.updateDubbingState(message.payload);
      case "setVideoVolumeWhilePlayingDubbing":
        return this.setVideoVolumeWhilePlayingDubbing(message.payload);
      default:
        throw new Error(`Unknown action: ${(message as any).action}`);
    }
  }

  private async setVideoVolumeWhilePlayingDubbing(
    volume: number
  ): Promise<any> {
    this.dubbingManager.setVideoVolumeWhilePlayingDubbing(volume);
    return { status: "updated" };
  }

  private async initializeDubbing(
    movieId: string,
    languageCode: string,
    srtContent: string | null,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<any> {
    if (!this.checkForVideoElement()) {
      throw new Error("No video element found on the page");
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
      throw error;
    }
  }

  private async stopDubbing(): Promise<any> {
    try {
      await this.dubbingManager.stop();
      await this.updateDubbingState(false);
      return { status: "stopped" };
    } catch (error) {
      console.error("Error stopping dubbing:", error);
      throw error;
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
      "movieId",
      "languageCode",
      "srtContent",
      "seasonNumber",
      "episodeNumber",
    ])) as StorageData;

    if (storage.isDubbingActive && storage.movieId && storage.languageCode) {
      try {
        if (!this.checkForVideoElement()) {
          throw new Error("No video element found on the page");
        }

        await this.dubbingManager.initialize(
          storage.movieId,
          storage.languageCode,
          storage.srtContent,
          storage.seasonNumber,
          storage.episodeNumber
        );
        await this.updateDubbingState(true);
        console.log("Dubbing initialized from storage successfully");
      } catch (error) {
        console.error("Failed to initialize dubbing from storage:", error);
        await this.updateDubbingState(false);
      }
    } else if (storage.isDubbingActive) {
      await this.updateDubbingState(false);
      console.warn("Dubbing was active but missing necessary data");
    } else {
      console.log("No active dubbing session found in storage");
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

  private async updateStorage(data: Partial<StorageData>): Promise<void> {
    await chrome.storage.local.set(data);
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

console.log("Content script loaded");

(window as any).__DUBBING_CONTENT_SCRIPT_LOADED__ = true;
