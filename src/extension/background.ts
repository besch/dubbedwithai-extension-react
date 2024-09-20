import { DubbingMessage } from "@/types";
import { IconManager } from "./content/IconManager";
import * as api from "@/api";

class BackgroundService {
  private iconManager: IconManager;
  private isDubbingActive: boolean = false;

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
      case "updateVideoPlaybackState":
        this.handleUpdateVideoPlaybackState(message);
        break;
      default:
        break;
    }
    return true;
  }

  private onSuspend(): void {
    this.iconManager.stopPulsing();
    this.saveDubbingState();
  }

  private saveDubbingState(): void {
    chrome.storage.local.set({ isDubbingActive: this.isDubbingActive });
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
              this.isDubbingActive = false;
            } else if (response?.isDubbingActive !== undefined) {
              this.updateDubbingState(response.isDubbingActive, tabs[0].id!);
              this.updateStorageDubbingState(response.isDubbingActive);
              this.isDubbingActive = response.isDubbingActive;
            } else {
              this.iconManager.stopPulsing();
              this.iconManager.updateIcon(false);
              this.updateStorageDubbingState(false);
              this.isDubbingActive = false;
            }
          }
        );
      } else {
        this.iconManager.stopPulsing();
        this.iconManager.updateIcon(false);
        this.updateStorageDubbingState(false);
        this.isDubbingActive = false;
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
}

new BackgroundService();
