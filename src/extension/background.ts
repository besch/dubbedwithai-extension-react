import { parseSrt } from "./utils";
import { getAuthToken } from "./auth";
import { DubbingMessage } from "./content/types";

const iconBasePath = chrome.runtime.getURL("icons/");
let pulseInterval: NodeJS.Timer | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchSubtitles(
  movieId: string,
  subtitleId: string
): Promise<string | null> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("No auth token available");
    }

    const response = await fetch(
      `${process.env.REACT_APP_BASE_API_URL}/api/google-storage/fetch-subtitles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ movieId, subtitleId }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();
    return text;
  } catch (e) {
    console.error("There was a problem fetching the subtitles:", e);
    return null;
  }
}

async function fetchAudioFile(
  movieId: string,
  subtitleId: string,
  fileName: string
): Promise<ArrayBuffer | null> {
  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("No auth token available");
    }

    const response = await fetch(
      `${process.env.REACT_APP_BASE_API_URL}/api/google-storage/fetch-audio-file`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ movieId, subtitleId, fileName }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.arrayBuffer();
  } catch (e) {
    console.error("There was a problem fetching the audio file:", e);
    return null;
  }
}

async function checkAndUpdateAuthStatus() {
  try {
    const token = await getAuthToken();
    if (token) {
      chrome.storage.local.set({ authToken: token });
    } else {
      chrome.storage.local.remove(["authToken"]);
    }
  } catch (error) {
    console.error("Error checking auth status:", error);
    chrome.storage.local.remove(["authToken"]);
  }
}

function checkDubbingStatus(tabId: number): void {
  chrome.tabs.sendMessage(tabId, {
    action: "checkDubbingStatus",
  } as DubbingMessage);
}

function updateIcon(isDubbingActive: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const iconPath = isDubbingActive
      ? {
          16: `${iconBasePath}mic-active16.png`,
          48: `${iconBasePath}mic-active48.png`,
          128: `${iconBasePath}mic-active128.png`,
        }
      : {
          16: `${iconBasePath}mic-inactive16.png`,
          48: `${iconBasePath}mic-inactive48.png`,
          128: `${iconBasePath}mic-inactive128.png`,
        };
    chrome.action.setIcon({ path: iconPath }, () => {
      if (chrome.runtime.lastError) {
        reject(
          new Error(`Error setting icon: ${chrome.runtime.lastError.message}`)
        );
      } else {
        resolve();
      }
    });
  });
}

function updateDubbingState(isActive: boolean, tabId: number) {
  updateIcon(isActive).catch((error) =>
    console.error("Error updating icon:", error)
  );
}

function checkDubbingStatusOnActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "checkDubbingStatus" },
        (response) => {
          if (response && response.isDubbingActive !== undefined) {
            updateDubbingState(response.isDubbingActive, tabs[0].id!);
          }
        }
      );
    }
  });
}

chrome.tabs.onActivated.addListener((activeInfo) => {
  checkDubbingStatusOnActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    checkDubbingStatusOnActiveTab();
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    checkDubbingStatusOnActiveTab();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("movieState", (result) => {
    chrome.storage.local.set({ movieState: result.movieState ?? {} });
  });
  checkAndUpdateAuthStatus();
});

chrome.runtime.onStartup.addListener(() => {
  checkAndUpdateAuthStatus();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "requestSubtitles") {
    (async () => {
      const subtitles = await fetchSubtitles(
        message.movieId,
        message.subtitleId
      );
      sendResponse({
        action: "subtitlesData",
        data: subtitles ? parseSrt(subtitles) : null,
      });
    })();
    return true;
  } else if (message.action === "requestAudioFile") {
    (async () => {
      const audioData = await fetchAudioFile(
        message.movieId,
        message.subtitleId,
        message.fileName
      );
      sendResponse({
        action: "audioFileData",
        data: audioData ? arrayBufferToBase64(audioData) : null,
      });
    })();
    return true;
  } else if (message.action === "checkAuthStatus") {
    checkAndUpdateAuthStatus().then(() => {
      sendResponse({ action: "authStatusChecked" });
    });
    return true;
  } else if (
    message.action === "updateDubbingState" &&
    sender.tab &&
    sender.tab.id
  ) {
    updateDubbingState(message.payload, sender.tab.id);
  }
});
