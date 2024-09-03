import { parseSrt } from "./utils";
import { DubbingMessage, Subtitle } from "@/types";
import { IconManager } from "./content/IconManager";

const API_BASE_URL = process.env.REACT_APP_BASE_API_URL;

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
    console.log("Background script received message:", message);
    const handlers: Record<
      string,
      (msg: any, res: (response?: any) => void) => void
    > = {
      requestSubtitles: this.handleSubtitlesRequest.bind(this),
      requestAudioFile: this.handleAudioFileRequest.bind(this),
      updateDubbingState: (msg) => {
        console.log("Updating dubbing state:", msg.payload);
        if (sender.tab?.id) {
          this.updateDubbingState(msg.payload, sender.tab.id);
        }
        sendResponse({ status: "updated" });
      },
      updateCurrentTime: (msg) => chrome.runtime.sendMessage(msg),
      checkAudioFileExists: this.handleCheckAudioFileExists.bind(this),
      generateAudio: this.handleGenerateAudio.bind(this),
      setSubtitles: this.handleSetSubtitles.bind(this),
      fetchSubtitlesFromGoogleStorage:
        this.handleFetchSubtitlesFromGoogleStorage.bind(this),
      updateVideoPlaybackState: this.handleVideoPlaybackStateUpdate.bind(this),
    };

    const handler = handlers[message.action];
    if (handler) {
      handler(message, sendResponse);
      return true;
    }
    console.warn("No handler found for message:", message);
    return false;
  }

  private handleSetSubtitles(
    message: { movieId: string; languageCode: string; subtitles: string },
    sendResponse: (response?: any) => void
  ): void {
    const { movieId, languageCode, subtitles } = message;
    const cacheKey = `${movieId}_${languageCode}`;
    this.subtitlesCache[cacheKey] = subtitles;
    this.clearOldSubtitlesCache();
    console.log("Subtitles set in background script:", {
      movieId,
      languageCode,
    });
    sendResponse({ status: "success" });
  }

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
      const response = await fetch(
        `${API_BASE_URL}/api/google-storage/check-file-exists`,
        {
          method: "POST",
          body: JSON.stringify({ filePath }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      sendResponse({ exists: data.exists });
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
      const response = await fetch(
        `${API_BASE_URL}/api/openai/generate-audio`,
        {
          method: "POST",
          body: JSON.stringify({ text, filePath }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();
      sendResponse({ success: true, message: result.message });
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
    console.log(`Updating dubbing state: isActive=${isActive}, tabId=${tabId}`);
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
            } else if (response?.isDubbingActive !== undefined) {
              this.updateDubbingState(response.isDubbingActive, tabs[0].id!);
            } else {
              this.iconManager.stopPulsing();
              this.iconManager.updateIcon(false);
            }
          }
        );
      } else {
        this.iconManager.stopPulsing();
        this.iconManager.updateIcon(false);
      }
    });
  }

  private async fetchAudioFile(filePath: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/google-storage/fetch-audio-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ filePath }),
        }
      );

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.arrayBuffer();
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
            if (
              request.action === "setSubtitles" &&
              request.movieId === movieId &&
              request.subtitleId === subtitleId
            ) {
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
      const response = await fetch(
        `${API_BASE_URL}/api/google-storage/fetch-subtitles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ movieId, subtitleId }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch subtitles from Google Storage");
      }

      const data = await response.json();
      return data.subtitles;
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
