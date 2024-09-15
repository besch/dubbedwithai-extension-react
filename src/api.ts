import { Movie, Subtitle } from "@/types";

const API_BASE_URL = process.env.REACT_APP_BASE_API_URL;

const apiFetch = async <T>(
  endpoint: string,
  method: string,
  body?: object
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return await response.json();
};

export const fetchMovies = (query: string): Promise<Movie[]> =>
  apiFetch<{ Search: Movie[] }>("/api/search-movies", "POST", {
    text: query,
  }).then((data) => data.Search);

export const fetchSubtitles = (params: {
  imdbID: string;
  languageCode: string;
  seasonNumber?: number;
  episodeNumber?: number;
}): Promise<{ srtContent: string; subtitleInfo: any }> =>
  apiFetch("/api/opensubtitles/fetch-subtitles", "POST", params);

export const checkAudioFileExists = (filePath: string): Promise<boolean> =>
  apiFetch<{ exists: boolean }>(
    "/api/google-storage/check-file-exists",
    "POST",
    { filePath }
  ).then((data) => data.exists);

export const fetchSubtitlesFromGoogleStorage = (
  movieId: string,
  subtitleId: string
): Promise<Subtitle[]> =>
  apiFetch<{ subtitles: Subtitle[] }>(
    "/api/google-storage/fetch-subtitles",
    "POST",
    { movieId, subtitleId }
  ).then((data) => data.subtitles);

export const sendFeedback = (values: {
  email: string;
  subject: string;
  message: string;
}): Promise<void> => apiFetch("/api/send-feedback", "POST", values);

export const generateAudio = (text: string, filePath: string): Promise<any> =>
  apiFetch("/api/openai/generate-audio", "POST", { text, filePath });

export const fetchAudioFile = async (
  filePath: string
): Promise<ArrayBuffer> => {
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
