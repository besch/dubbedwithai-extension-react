import { Movie, Subtitle } from "@/types";

const API_BASE_URL = process.env.REACT_APP_BASE_API_URL;

const API_ENDPOINTS = {
  SEARCH_MOVIES: '/api/search-movies',
  FETCH_SUBTITLES: '/api/opensubtitles/fetch-subtitles',
  CHECK_FILE_EXISTS: '/api/google-storage/check-file-exists',
  GENERATE_AUDIO: '/api/openai/generate-audio',
  FETCH_AUDIO_FILE: '/api/google-storage/fetch-audio-file',
  FETCH_SUBTITLES_GS: '/api/google-storage/fetch-subtitles',
  SEND_FEEDBACK: '/api/send-feedback',
};

const apiFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const fetchMovies = (query: string): Promise<Movie[]> =>
  apiFetch<{ Search: Movie[] }>(API_ENDPOINTS.SEARCH_MOVIES, {
    method: 'POST',
    body: JSON.stringify({ text: query }),
  }).then(data => data.Search);

export const fetchSubtitles = (params: {
  imdbID: string;
  languageCode: string;
  seasonNumber?: number;
  episodeNumber?: number;
}): Promise<{ srtContent: string; subtitleInfo: any }> =>
  apiFetch(API_ENDPOINTS.FETCH_SUBTITLES, {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const checkAudioFileExists = (filePath: string): Promise<boolean> =>
  apiFetch<{ exists: boolean }>(API_ENDPOINTS.CHECK_FILE_EXISTS, {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  }).then(data => data.exists);

export const generateAudio = (text: string, filePath: string): Promise<{ success: boolean; message: string }> =>
  apiFetch(API_ENDPOINTS.GENERATE_AUDIO, {
    method: 'POST',
    body: JSON.stringify({ text, filePath }),
  });

export const fetchAudioFile = async (filePath: string): Promise<ArrayBuffer> => {
  const response = await apiFetch<Response>(API_ENDPOINTS.FETCH_AUDIO_FILE, {
    method: 'POST',
    body: JSON.stringify({ filePath }),
  });
  return response.arrayBuffer();
};

export const fetchSubtitlesFromGoogleStorage = (
  movieId: string,
  subtitleId: string
): Promise<Subtitle[]> =>
  apiFetch<{ subtitles: Subtitle[] }>(API_ENDPOINTS.FETCH_SUBTITLES_GS, {
    method: 'POST',
    body: JSON.stringify({ movieId, subtitleId }),
  }).then(data => data.subtitles);

export const sendFeedback = (values: {
  email: string;
  subject: string;
  message: string;
}): Promise<void> =>
  apiFetch(API_ENDPOINTS.SEND_FEEDBACK, {
    method: 'POST',
    body: JSON.stringify(values),
  });