import { DubbingMessage } from "@/types";
import { IconManager } from "./content/IconManager";
import * as api from "@/api";

class BackgroundService {
  private iconManager: IconManager;

  constructor() {
    this.iconManager = new IconManager();
    this.initializeListeners();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.iconManager.preloadIcons();
    await this.initializeStorage();
  }

  private initializeListeners(): void {
    chrome.runtime.onInstalled.addListener(this.onInstalled.bind(this));
    chrome.runtime.onStartup.addListener(this.onStartup.bind(this));
    chrome.runtime.onMessage.addListener(this.onMessage.bind(this));
    chrome.alarms.onAlarm.addListener(this.onAlarm.bind(this));
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
    await chrome.storage.local.clear();
    await this.iconManager.preloadIcons();
    await this.initializeStorage();
    await this.stopDubbingOnAllTabs();
  }

  private async onStartup(): Promise<void> {
    await this.iconManager.preloadIcons();
    await this.retrieveDubbingState();
  }

  private async retrieveDubbingState(): Promise<void> {
    const { isDubbingActive } = await chrome.storage.local.get(
      "isDubbingActive"
    );
    if (isDubbingActive) {
      this.checkDubbingStatusOnActiveTab();
    }
  }

  private onMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    switch (message.action) {
      case "updateDubbingState":
        if (sender.tab?.id) {
          this.updateDubbingState(message.payload);
        }
        sendResponse({ status: "updated" });
        break;
      case "fetchAudioFile":
        this.handleFetchAudioFile(message, sendResponse);
        break;
      case "updateVideoPlaybackState":
        this.handleUpdateVideoPlaybackState(message);
        break;
      case "updateSubtitles":
        chrome.runtime.sendMessage(message);
        break;
      case "stopDubbing":
        this.stopDubbingOnAllTabs();
        sendResponse({ status: "stopped" });
        break;
      case "dubbingStopped":
        this.updateDubbingState(false);
        break;
      default:
        break;
    }
    return true;
  }

  private async handleFetchAudioFile(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { filePath, text } = message;
    const url = await this.getCurrentTabUrl();
    try {
      let audioBuffer: ArrayBuffer;
      try {
        audioBuffer = await api.fetchAudioFile(filePath, url);
      } catch (fetchError) {
        audioBuffer = await api.generateAudio(text, filePath, url);
      }
      const base64Audio = this.arrayBufferToBase64(audioBuffer);
      sendResponse({ success: true, audioData: base64Audio });
    } catch (e: unknown) {
      console.error("Error fetching or generating audio file:", e);
      sendResponse({
        error: "Failed to fetch or generate audio file",
        details: e instanceof Error ? e.message : "An unknown error occurred",
      });
    }
  }

  private onAlarm(alarm: chrome.alarms.Alarm): void {
    if (alarm.name === "iconPulse") {
      this.iconManager.togglePulseState();
    }
  }

  private async initializeStorage(): Promise<void> {
    const { movieState } = await chrome.storage.local.get("movieState");
    chrome.storage.local.set({ movieState: movieState ?? {} });
  }

  private async updateDubbingState(isActive: boolean): Promise<void> {
    if (isActive) {
      this.iconManager.startPulsing();
    } else {
      this.iconManager.stopPulsing();
    }
    await this.iconManager.updateIcon(isActive);
    this.updateStorageDubbingState(isActive);
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
              this.updateDubbingState(response.isDubbingActive);
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

  private async handleGenerateAudio(
    message: any,
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { text, filePath } = message;
    const url = await this.getCurrentTabUrl();

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
      const audioBuffer = await api.generateAudio(text, filePath, url);
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

  private async getCurrentTabUrl(): Promise<string> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.url || "");
      });
    });
  }

  private async stopDubbingOnAllTabs(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: "stopDubbing" });
        } catch (error) {
          console.error(`Failed to stop dubbing on tab ${tab.id}:`, error);
        }
      }
    }
    await this.updateDubbingState(false);
  }
}

new BackgroundService();
