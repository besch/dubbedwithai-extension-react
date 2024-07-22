import { parseSrt } from "./utils";
import { getAuthToken } from "./auth";
import { DubbingMessage } from "./content/types";

const API_BASE_URL = process.env.REACT_APP_BASE_API_URL;
const ICON_BASE_PATH = chrome.runtime.getURL("icons/");
const ICON_SIZES = [16, 48, 128] as const;
const ICON_STATES = ["active", "active-filled", "inactive"] as const;

type IconSize = (typeof ICON_SIZES)[number];
type IconState = (typeof ICON_STATES)[number];

class BackgroundService {
  private iconCache: Record<string, ImageData> = {};
  private isPulsing = false;
  private pulseState = false;
  private subtitlesCache: { [key: string]: string } = {};
  private pendingSubtitleRequests: { [key: string]: Promise<string | null> } =
    {};

  constructor() {
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
  }

  private async onInstalled(): Promise<void> {
    await this.preloadIcons();
    await this.initializeStorage();
    // await this.checkAndUpdateAuthStatus();
  }

  private async onStartup(): Promise<void> {
    await this.preloadIcons();
    // await this.checkAndUpdateAuthStatus();
  }

  private onMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    const handlers: Record<
      string,
      (msg: any, res: (response?: any) => void) => void
    > = {
      requestSubtitles: this.handleSubtitlesRequest.bind(this),
      requestAudioFile: this.handleAudioFileRequest.bind(this),
      // checkAuthStatus: this.handleAuthStatusCheck.bind(this),
      updateDubbingState: (msg, res) => {
        if (sender.tab?.id) this.updateDubbingState(msg.payload, sender.tab.id);
      },
      updateCurrentTime: (msg) => chrome.runtime.sendMessage(msg),
      checkAudioFileExists: this.handleCheckAudioFileExists.bind(this),
      generateAudio: this.handleGenerateAudio.bind(this),
    };

    const handler = handlers[message.action];
    if (handler) {
      handler(message, sendResponse);
      return true;
    }
    return false;
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

  private async fetchWithAuth(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await getAuthToken();
    if (!token) throw new Error("No auth token available");

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response;
  }

  private onSuspend(): void {
    chrome.alarms.clear("iconPulse");
  }

  private onAlarm(alarm: chrome.alarms.Alarm): void {
    if (alarm.name === "iconPulse") {
      this.pulseState = !this.pulseState;
      this.updateIcon(true, this.pulseState);
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

  private async preloadIcons(): Promise<void> {
    for (const size of ICON_SIZES) {
      for (const state of ICON_STATES) {
        await this.preloadIcon(size, state);
      }
    }
    console.log("Icons preloaded and cached");
  }

  private async preloadIcon(size: IconSize, state: IconState): Promise<void> {
    const iconUrl = `${ICON_BASE_PATH}mic-${state}${size}.png`;
    try {
      const response = await fetch(iconUrl);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(imageBitmap, 0, 0);
        this.iconCache[`${state}${size}`] = ctx.getImageData(0, 0, size, size);
      }
    } catch (error) {
      console.error(`Failed to preload icon: ${iconUrl}`, error);
    }
  }

  private async initializeStorage(): Promise<void> {
    const { movieState } = await chrome.storage.local.get("movieState");
    chrome.storage.local.set({ movieState: movieState ?? {} });
  }

  private startPulsing(): void {
    if (this.isPulsing) return;
    this.isPulsing = true;
    chrome.alarms.create("iconPulse", { periodInMinutes: 1 / 60 });
    this.updateIcon(true, false);
  }

  private stopPulsing(): void {
    if (!this.isPulsing) return;
    this.isPulsing = false;
    chrome.alarms.clear("iconPulse");
    this.updateIcon(false);
  }

  private updateDubbingState(isActive: boolean, tabId: number): void {
    isActive ? this.startPulsing() : this.stopPulsing();
  }

  private async updateIcon(
    isDubbingActive: boolean,
    pulse: boolean = false
  ): Promise<void> {
    const state = isDubbingActive
      ? pulse
        ? "active-filled"
        : "active"
      : "inactive";
    const iconData: { [key: number]: ImageData } = {};

    ICON_SIZES.forEach((size) => {
      const cachedIcon = this.iconCache[`${state}${size}`];
      if (cachedIcon instanceof ImageData) {
        iconData[size] = cachedIcon;
      }
    });

    if (Object.keys(iconData).length === 0) {
      throw new Error("No valid ImageData found in iconCache");
    }

    return new Promise((resolve, reject) => {
      chrome.action.setIcon({ imageData: iconData }, () => {
        chrome.runtime.lastError
          ? reject(
              new Error(
                `Error setting icon: ${chrome.runtime.lastError.message}`
              )
            )
          : resolve();
      });
    });
  }

  private checkDubbingStatusOnActiveTab(): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "checkDubbingStatus" } as DubbingMessage,
          (response) => {
            if (response?.isDubbingActive !== undefined) {
              this.updateDubbingState(response.isDubbingActive, tabs[0].id!);
            }
          }
        );
      }
    });
  }

  private async fetchSubtitles(
    movieId: string,
    subtitleId: string
  ): Promise<string | null> {
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } catch (e) {
      console.error("There was a problem fetching the subtitles:", e);
      return null;
    }
  }

  private clearOldSubtitlesCache(maxEntries: number = 3) {
    const cacheKeys = Object.keys(this.subtitlesCache);
    if (cacheKeys.length > maxEntries) {
      const keysToRemove = cacheKeys.slice(0, cacheKeys.length - maxEntries);
      keysToRemove.forEach((key) => delete this.subtitlesCache[key]);
    }
  }

  private async fetchAudioFile(filePath: string): Promise<ArrayBuffer | null> {
    try {
      // const token = await getAuthToken();
      // if (!token) throw new Error("No auth token available");

      const response = await fetch(
        `${API_BASE_URL}/api/google-storage/fetch-audio-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Authorization: `Bearer ${token}`,
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

    try {
      let subtitles: string | null;

      if (this.subtitlesCache[cacheKey]) {
        subtitles = this.subtitlesCache[cacheKey];
      } else {
        if (!this.pendingSubtitleRequests[cacheKey]) {
          this.pendingSubtitleRequests[cacheKey] = this.fetchSubtitles(
            movieId,
            subtitleId
          );
        }

        subtitles = await this.pendingSubtitleRequests[cacheKey];

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
      console.error("Error fetching subtitles:", error);
      sendResponse({
        action: "subtitlesData",
        data: null,
        error: "Failed to fetch subtitles",
      });
    } finally {
      delete this.pendingSubtitleRequests[cacheKey];
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

  // private async handleAuthStatusCheck(
  //   sendResponse: (response: any) => void
  // ): Promise<void> {
  //   await this.checkAndUpdateAuthStatus();
  //   sendResponse({ action: "authStatusChecked" });
  // }

  // private async checkAndUpdateAuthStatus(): Promise<void> {
  //   try {
  //     const token = await getAuthToken();
  //     token
  //       ? chrome.storage.local.set({ authToken: token })
  //       : chrome.storage.local.remove(["authToken"]);
  //   } catch (error) {
  //     console.error("Error checking auth status:", error);
  //     chrome.storage.local.remove(["authToken"]);
  //   }
  // }
}

new BackgroundService();
