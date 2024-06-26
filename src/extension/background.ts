import { srtToObject } from "./utils";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

async function fetchSubtitles(
  movieId: string,
  language: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://storage.googleapis.com/dubbed_with_ai/${movieId}/languages/${language}/subtitles.srt`
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
      `https://storage.googleapis.com/dubbed_with_ai/${movieId}/languages/${language}/audio/${fileName}`
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
      if (subtitles) {
        const subtitlesData = srtToObject(subtitles);
        sendResponse({ action: "subtitlesData", data: subtitlesData });
      } else {
        sendResponse({ action: "subtitlesData", data: null });
      }
    });
    return true;
  } else if (message.action === "requestAudioFile") {
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
