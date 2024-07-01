import { parseSrt } from "./utils.js";

async function fetchSubtitles(
  movieId: string,
  subtitleId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${process.env.REACT_APP_BASE_API_URL}/api/google-storage/fetch-subtitles`,
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
    const response = await fetch(
      `${process.env.REACT_APP_BASE_API_URL}/api/google-storage/fetch-audio-file`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
