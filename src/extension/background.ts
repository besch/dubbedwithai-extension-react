import { parseSrt } from "./utils.js";
import { getAuthToken } from "./auth.js";

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("movieState", (result) => {
    if (!result.movieState) {
      chrome.storage.local.set({ movieState: {} });
    }
  });

  checkAndUpdateAuthStatus();
});

chrome.runtime.onStartup.addListener(() => {
  checkAndUpdateAuthStatus();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "requestSubtitles") {
    console.log("requestSubtitles", message);
    fetchSubtitles(message.movieId, message.subtitleId).then((subtitles) => {
      if (subtitles) {
        const subtitlesData = parseSrt(subtitles);
        sendResponse({
          action: "subtitlesData",
          data: subtitlesData,
        });
      } else {
        sendResponse({ action: "subtitlesData", data: null });
      }
    });
    return true;
  } else if (message.action === "requestAudioFile") {
    console.log("requestAudioFile", message);
    fetchAudioFile(message.movieId, message.subtitleId, message.fileName).then(
      (audioData) => {
        if (audioData) {
          // Replace the problematic line with this function
          const base64Audio = arrayBufferToBase64(audioData);
          sendResponse({ action: "audioFileData", data: base64Audio });
        } else {
          sendResponse({ action: "audioFileData", data: null });
        }
      }
    );
    return true;
  } else if (message.action === "checkAuthStatus") {
    // New message handler to check auth status
    checkAndUpdateAuthStatus().then(() => {
      sendResponse({ action: "authStatusChecked" });
    });
    return true;
  }
});
