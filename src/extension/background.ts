import { parseSrt } from "./utils";
import { DubbingMessage, Subtitle } from "@/types";
import { IconManager } from "./content/IconManager";
import * as api from "@/api";

class BackgroundService {
  private subtitlesCache: { [key: string]: string } = {};
  private iconManager: IconManager;

  constructor() {
    this.iconManager = new IconManager();
    this.initializeListeners();
  }

  private initializeListeners(): void {
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
    chrome.runtime.onStartup.addListener(this.onStartup.bind(this));
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
    chrome.runtime.onSuspend.addListener(this.onSuspend.bind(this));
    chrome.alarms.onAlarm.addListener(this.onAlarm.bind(this));
    chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    chrome.windows.onFocusChanged.addListener(
      this.onWindowFocusChanged.bind(this)
    );
    chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this));
  }

  private handleUpdateVideoPlaybackState(message: any): void {
    if (message.isDubbingActive) {
      this.updateStorageDubbingState(true);
      chrome.runtime.sendMessage({
        action: "updateDubbingState",
        payload: true,
      });
    }
  }

  private async onInstalled(): Promise<void> {
    await this.iconManager.preloadIcons();
    await this.initializeStorage();
  }

  private async onStartup(): Promise<void> {
    await this.iconManager.preloadIcons();
  }

  private onMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    switch (message.action) {
      case "requestSubtitles":
        this.handleSubtitlesRequest(message, sendResponse);
        break;
      case "requestAudioFile":
        this.handleAudioFileRequest(message, sendResponse);
        break;
      case "updateDubbingState":
        if (sender.tab?.id) {
          this.updateDubbingState(message.payload, sender.tab.id);
        }
        sendResponse({ status: "updated" });
        break;
      case "checkAudioFileExists":
        this.handleCheckAudioFileExists(message, sendResponse);
        break;
      case "generateAudio":
        this.handleGenerateAudio(message, sendResponse);
        break;
      // case "setSubtitles":
      //   this.handleSetSubtitles(message, sendResponse);
      //   break;
      case "fetchSubtitlesFromGoogleStorage":
        this.handleFetchSubtitlesFromGoogleStorage(message, sendResponse);
        break;
      case "updateVideoPlaybackState":
        this.handleUpdateVideoPlaybackState(message);
        break;
      default:
        break;
    }
    return true;
  }

  // private handleSetSubtitles(
  //   message: {
  //     subtitles: string;
  //     movieId?: string;
  //     languageCode?: string;
  //   },
  //   sendResponse: (response?: any) => void
  // ): void {
  //   console.log("Handling set subtitles:", message);
  //   const { movieId, languageCode, subtitles } = message;

  //   if (movieId && languageCode) {
  //     const cacheKey = `${movieId}_${languageCode}`;
  //     this.subtitlesCache[cacheKey] = subtitles;
  //   } else {
  //     // Handle uploaded subtitles without movieId and languageCode
  //     const uploadedCacheKey = "uploaded_subtitles";
  //     this.subtitlesCache[uploadedCacheKey] = subtitles;
  //   }

  //   this.clearOldSubtitlesCache();
  //   sendResponse({ status: "success" });
  // }

  private clearOldSubtitlesCache(maxEntries: number = 3) {
    const cacheKeys = Object.keys(this.subtitlesCache);
    if (cacheKeys.length > maxEntries) {
      const keysToRemove = cacheKeys.slice(0, cacheKeys.length - maxEntries);
      keysToRemove.forEach((key) => delete this.subtitlesCache[key]);
    }
  }

  private async handleCheckAudioFileExists(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { filePath } = message;
    try {
      const exists = await api.checkAudioFileExists(filePath);
      sendResponse({ exists });
    } catch (e) {
      console.error("Error checking if audio file exists:", e);
      sendResponse({
        exists: false,
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  private async handleGenerateAudio(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { text, filePath } = message;

    if (!text || !filePath) {
      sendResponse({
        error: "Missing required parameters",
        details: {
          text: text ? "provided" : "missing",
          filePath: filePath ? "provided" : "missing",
        },
      });
      return;
    }

    try {
      const audioBuffer = await api.generateAudio(text, filePath);
      const base64Audio = this.arrayBufferToBase64(audioBuffer);
      sendResponse({ success: true, audioData: base64Audio });
    } catch (e: unknown) {
      console.error("Error generating audio:", e);
      sendResponse({
        error: "Failed to generate audio",
        details: e instanceof Error ? e.message : "An unknown error occurred",
      });
    }
  }

  private onSuspend(): void {
    this.iconManager.stopPulsing();
  }

  private onAlarm(alarm: chrome.alarms.Alarm): void {
    if (alarm.name === "iconPulse") {
      this.iconManager.togglePulseState();
    }
  }

  private onTabActivated(): void {
    this.checkDubbingStatusOnActiveTab();
  }

  private onTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): void {
    if (changeInfo.status === "complete" && tab.active) {
      this.checkDubbingStatusOnActiveTab();
    }
  }

  private onWindowFocusChanged(windowId: number): void {
    if (windowId !== chrome.windows.WINDOW_ID_NONE) {
      this.checkDubbingStatusOnActiveTab();
    }
  }

  private async initializeStorage(): Promise<void> {
    const { movieState } = await chrome.storage.local.get("movieState");
    chrome.storage.local.set({ movieState: movieState ?? {} });
  }

  private async updateDubbingState(
    isActive: boolean,
    tabId: number
  ): Promise<void> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id === tabId) {
      if (isActive) {
        this.iconManager.startPulsing();
      } else {
        this.iconManager.stopPulsing();
      }
      this.iconManager.updateIcon(isActive);
    } else {
      this.iconManager.stopPulsing();
      this.iconManager.updateIcon(false);
    }

    this.updateStorageDubbingState(isActive);
  }

  private onTabRemoved(
    tabId: number,
    removeInfo: chrome.tabs.TabRemoveInfo
  ): void {
    this.checkDubbingStatusOnActiveTab();
  }

  private checkDubbingStatusOnActiveTab(): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "checkDubbingStatus" } as DubbingMessage,
          (response) => {
            if (chrome.runtime.lastError) {
              this.iconManager.stopPulsing();
              this.iconManager.updateIcon(false);
              this.updateStorageDubbingState(false);
            } else if (response?.isDubbingActive !== undefined) {
              this.updateDubbingState(response.isDubbingActive, tabs[0].id!);
              this.updateStorageDubbingState(response.isDubbingActive);
            } else {
              this.iconManager.stopPulsing();
              this.iconManager.updateIcon(false);
              this.updateStorageDubbingState(false);
            }
          }
        );
      } else {
        this.iconManager.stopPulsing();
        this.iconManager.updateIcon(false);
        this.updateStorageDubbingState(false);
      }
    });
  }

  private updateStorageDubbingState(isDubbingActive: boolean): void {
    chrome.storage.local.set({ isDubbingActive });
  }

  private async fetchAudioFile(filePath: string): Promise<ArrayBuffer | null> {
    try {
      return await api.fetchAudioFile(filePath);
    } catch (e) {
      console.error("There was a problem fetching the audio file:", e);
      return null;
    }
  }

  arrayBufferToBase64(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32KB chunks
    let result = "";

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      result += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }

    return btoa(result);
  }

  private async handleSubtitlesRequest(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    console.warn("!!!!!!!!!!!!!!message", message);
    const { movieId, subtitleId } = message;
    const cacheKey = `${movieId}_${subtitleId}`;

    console.log("Handling subtitles request:", { movieId, subtitleId });
    try {
      let subtitles: string | null;

      if (this.subtitlesCache[cacheKey]) {
        subtitles = this.subtitlesCache[cacheKey];
      } else {
        // Instead of fetching, wait for subtitles to be set
        subtitles = await new Promise((resolve) => {
          const listener = (request: any) => {
            if (request.action === "setSubtitles") {
              console.warn("!!!!!!!!!!!!!!request", request);
              chrome.runtime.onMessage.removeListener(listener);
              resolve(request.subtitles);
            }
          };
          chrome.runtime.onMessage.addListener(listener);
        });

        if (subtitles) {
          this.subtitlesCache[cacheKey] = subtitles;
          this.clearOldSubtitlesCache();
        }
      }

      console.warn("subtitles", subtitles ? parseSrt(subtitles) : null);

      sendResponse({
        action: "subtitlesData",
        data: subtitles ? parseSrt(subtitles) : null,
      });
    } catch (error) {
      console.error("Error handling subtitles request:", error);
      sendResponse({
        action: "subtitlesData",
        data: null,
        error: "Failed to handle subtitles request",
      });
    }
  }

  private async handleAudioFileRequest(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    const audioData = await this.fetchAudioFile(message.filePath);
    sendResponse({
      action: "audioFileData",
      data: audioData ? this.arrayBufferToBase64(audioData) : null,
    });
  }

  private async fetchSubtitlesFromGoogleStorage(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    try {
      return await api.fetchSubtitlesFromGoogleStorage(movieId, subtitleId);
    } catch (error) {
      console.error("Error fetching subtitles from Google Storage:", error);
      return null;
    }
  }

  private async handleFetchSubtitlesFromGoogleStorage(
    message: { movieId: string; subtitleId: string },
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { movieId, subtitleId } = message;
    try {
      const subtitles = await this.fetchSubtitlesFromGoogleStorage(
        movieId,
        subtitleId
      );
      sendResponse({ subtitles });
    } catch (error) {
      console.error("Error in handleFetchSubtitlesFromGoogleStorage:", error);
      sendResponse({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private handleVideoPlaybackStateUpdate(
    message: { isPlaying: boolean; isDubbingActive: boolean },
    sendResponse: (response?: any) => void
  ): void {
    const { isPlaying, isDubbingActive } = message;
    if (isDubbingActive) {
      if (isPlaying) {
        this.iconManager.startPulsing();
      } else {
        this.iconManager.stopPulsing();
      }
    } else {
      this.iconManager.stopPulsing();
    }
    sendResponse({ status: "updated" });
  }
}

new BackgroundService();
