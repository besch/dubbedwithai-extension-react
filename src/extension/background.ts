import { parseSrt } from "./utils";
import { getAuthToken } from "./auth";
import { DubbingMessage } from "./content/types";

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

chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
  checkDubbingStatus(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(
  (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ) => {
    if (changeInfo.status === "complete") {
      checkDubbingStatus(tabId);
    }
  }
);

chrome.windows.onFocusChanged.addListener((windowId: number) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query(
      { active: true, windowId: windowId },
      (tabs: chrome.tabs.Tab[]) => {
        if (tabs.length > 0 && tabs[0].id) {
          checkDubbingStatus(tabs[0].id);
        }
      }
    );
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
  } else if (message.action === "updateDubbingState") {
    chrome.storage.local.set({ isDubbingActive: message.payload });
    // Optionally, notify all tabs about the state change
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: "dubbingStateChanged",
            isDubbingActive: message.payload,
          });
        }
      });
    });
  }
});
