import { srtToObject } from "./utils.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

async function fetchSubtitles(
  movieId: string,
  language: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `http://localhost:3000/api/google-storage/fetch-subtitles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ movieId, language }),
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

async function fetchAudioFile(
  movieId: string,
  language: string,
  fileName: string
): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(
      `http://localhost:3000/api/google-storage/fetch-audio-file`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ movieId, language, fileName }),
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "requestSubtitles") {
    fetchSubtitles(message.movieId, message.language).then((subtitles) => {
      // console.log("subtitles", subtitles);
      if (subtitles) {
        const subtitlesData = srtToObject(subtitles);
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
    fetchAudioFile(message.movieId, message.language, message.fileName).then(
      (audioData) => {
        if (audioData) {
          const base64Audio = btoa(
            String.fromCharCode.apply(
              null,
              Array.from(new Uint8Array(audioData))
            )
          );
          sendResponse({ action: "audioFileData", data: base64Audio });
        } else {
          sendResponse({ action: "audioFileData", data: null });
        }
      }
    );
    return true;
  }
});
