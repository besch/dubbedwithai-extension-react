import { Movie, Subtitle } from "@/types";

const API_BASE_URL = process.env.REACT_APP_BASE_API_URL;

export const fetchMovies = async (query: string): Promise<Movie[]> => {
  const response = await fetch(`${API_BASE_URL}/api/search-movies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: query }),
  });
  if (!response.ok) {
    throw new Error("Failed to search movies");
  }
  const data = await response.json();
  return data.Search as Movie[];
};

export const fetchSubtitles = async (params: {
  imdbID: string;
  languageCode: string;
  seasonNumber?: number;
  episodeNumber?: number;
}): Promise<{ srtContent: string; subtitleInfo: any }> => {
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
    throw new Error("No subtitles found for the selected language.");
  }
  return await response.json();
};

export const checkAudioFileExists = async (filePath: string): Promise<boolean> => {
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
  return data.exists;
};

export const generateAudio = async (text: string, filePath: string): Promise<{ success: boolean; message: string }> => {
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
  return await response.json();
};

export const fetchAudioFile = async (filePath: string): Promise<ArrayBuffer> => {
  const response = await fetch(
    `${API_BASE_URL}/api/google-storage/fetch-audio-file`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath }),
    }
  );
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.arrayBuffer();
};

export const fetchSubtitlesFromGoogleStorage = async (
  movieId: string,
  subtitleId: string
): Promise<Subtitle[]> => {
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
    throw new Error("Failed to fetch subtitles from Google Storage");
  }
  const data = await response.json();
  return data.subtitles;
};

export const sendFeedback = async (values: {
  email: string;
  subject: string;
  message: string;
}): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/api/send-feedback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to send feedback");
  }
};