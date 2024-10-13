import { Movie } from "@/types";

const API_BASE_URL = process.env.REACT_APP_BASE_API_URL;

export const fetchMovies = async (params: {
  text: string;
  url: string;
}): Promise<Movie[]> => {
  const response = await fetch(`${API_BASE_URL}/api/search-movies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.Search;
};

export const fetchSubtitles = async (params: {
  imdbID: string;
  languageCode: string;
  seasonNumber?: number;
  episodeNumber?: number;
  url: string;
}): Promise<{ srtContent: string }> => {
  const response = await fetch(
    `${API_BASE_URL}/api/opensubtitles/fetch-subtitles`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return await response.json();
};

export const generateAudio = async (
  text: string,
  filePath: string,
  url: string
): Promise<ArrayBuffer> => {
  const response = await fetch(`${API_BASE_URL}/api/openai/generate-audio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, filePath, url }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.arrayBuffer();
};

export const fetchAudioFile = async (
  filePath: string,
  url: string
): Promise<ArrayBuffer> => {
  const response = await fetch(`${API_BASE_URL}/api/fetch-audio-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filePath, url }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.arrayBuffer();
};

export const sendFeedback = async (values: {
  email: string;
  name: string;
  message: string;
}): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/send-feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
};

export const recognizeSpeech = async (
  audioData: string,
  languageCode: string
): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/api/recognize-speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audioData, languageCode }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (data && data.success) {
    return data.translatedTranscript;
  } else {
    throw new Error(data.error || "Speech recognition failed");
  }
};
