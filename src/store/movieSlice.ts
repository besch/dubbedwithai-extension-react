import { toast } from "react-toastify";
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";
import { RootState } from "@/store/index";
import { sendMessageToActiveTab } from "@/lib/messaging";
import config from "@/extension/content/config";
import languageCodes from "@/lib/languageCodes";
import { DubbingMessage, DubbingVoice } from "@/types";
import { fetchMovies, fetchSubtitles } from "@/api";
import { t } from "i18next";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  selectedSeasonNumber: number | null;
  selectedEpisodeNumber: number | null;
  srtContent: string | null;
  languages: Language[];
  dubbingVoice: DubbingVoice;
  isDubbingActive: boolean;
  searchResults: Movie[];
  subtitleOffset: number;
  dubbingVolumeMultiplier: number;
  videoVolumeWhilePlayingDubbing: number;
  subtitlesLoaded: boolean;
  lastSelectedLanguage: Language | null;
  isLoading: boolean;
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  selectedSeasonNumber: null,
  selectedEpisodeNumber: null,
  srtContent: null,
  dubbingVoice: "alloy",
  languages: Object.entries(languageCodes).map(([code, name]) => ({
    id: code,
    attributes: {
      language: code,
      language_name: name,
    },
  })),
  isDubbingActive: false,
  searchResults: [],
  subtitleOffset: 0,
  dubbingVolumeMultiplier: 1.0,
  videoVolumeWhilePlayingDubbing: config.videoVolumeWhilePlayingDubbing,
  subtitlesLoaded: false,
  lastSelectedLanguage: null,
  isLoading: false,
};

export const setDubbingVoice = createAsyncThunk(
  "movie/setDubbingVoice",
  async (voice: DubbingVoice, { dispatch, getState }) => {
    const state = getState() as RootState;
    const updatedMovieState = {
      ...state.movie,
      dubbingVoice: voice,
    };
    await chrome.storage.local.set({ movieState: updatedMovieState });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setDubbingVoice",
          payload: voice,
        });
      }
    });

    return voice;
  }
);

export const setLastSelectedLanguage = createAsyncThunk(
  "movie/setLastSelectedLanguage",
  async (language: Language, { dispatch }) => {
    await chrome.storage.local.set({ lastSelectedLanguage: language });
    dispatch(updateLastSelectedLanguage(language));
    return language;
  }
);

export const loadLastSelectedLanguage = createAsyncThunk(
  "movie/loadLastSelectedLanguage",
  async () => {
    return new Promise<Language | null>((resolve) => {
      chrome.storage.local.get(["lastSelectedLanguage"], (result) => {
        resolve(result.lastSelectedLanguage || null);
      });
    });
  }
);

export const loadSubtitles = createAsyncThunk(
  "movie/loadSubtitles",
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const { selectedMovie, selectedLanguage } = state.movie;

    if (!selectedMovie || !selectedLanguage) {
      return;
    }

    const url = await new Promise<string>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.url || "");
      });
    });

    return dispatch(
      selectSubtitle({
        imdbID: selectedMovie.imdbID,
        languageCode: selectedLanguage.id,
        seasonNumber: state.movie.selectedSeasonNumber || undefined,
        episodeNumber: state.movie.selectedEpisodeNumber || undefined,
        url,
      })
    ).unwrap();
  }
);

export const selectSubtitle = createAsyncThunk(
  "movie/selectSubtitle",
  async (
    params: {
      imdbID: string;
      languageCode: string;
      seasonNumber?: number;
      episodeNumber?: number;
      url: string;
    },
    { dispatch, getState }
  ) => {
    try {
      const state = getState() as RootState;
      const currentSrtContent = state.movie.srtContent;

      const data = await fetchSubtitles(params);

      if (!data.srtContent) {
        toast.error(t("noSubtitlesFound"));
        return null;
      }

      if (data.srtContent !== currentSrtContent) {
        dispatch(setSrtContent(data.srtContent));
        await chrome.storage.local.set({ srtContent: data.srtContent });
      }

      return true;
    } catch (error) {
      toast.error(t("subtitlesFetchError"));
      throw error;
    }
  }
);

export const setVideoVolumeWhilePlayingDubbing = createAsyncThunk(
  "movie/setVideoVolumeWhilePlayingDubbing",
  async (volume: number, { dispatch, getState }) => {
    const state = getState() as RootState;
    const updatedMovieState = {
      ...state.movie,
      videoVolumeWhilePlayingDubbing: volume,
    };
    await chrome.storage.local.set({ movieState: updatedMovieState });
    dispatch(updateVideoVolumeWhilePlayingDubbing(volume));
    return volume;
  }
);

export const loadMovieState = createAsyncThunk("movie/loadState", async () => {
  return new Promise<Partial<MovieState>>((resolve) => {
    chrome.storage.local.get(["movieState", "srtContent"], (result) => {
      const movieState = result.movieState || {};
      if (typeof movieState.subtitleOffset !== "number") {
        movieState.subtitleOffset = 0;
      }
      if (typeof movieState.videoVolumeWhilePlayingDubbing !== "number") {
        movieState.videoVolumeWhilePlayingDubbing =
          config.videoVolumeWhilePlayingDubbing;
      }
      movieState.srtContent = result.srtContent || null;
      resolve(movieState);
    });
  });
});

export const toggleDubbingProcess = createAsyncThunk(
  "movie/toggleDubbingProcess",
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const {
      selectedMovie,
      selectedLanguage,
      isDubbingActive,
      srtContent,
      selectedSeasonNumber,
      selectedEpisodeNumber,
    } = state.movie;

    if (!srtContent) {
      throw new Error("No subtitles found");
    }

    return new Promise<void>((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]?.id) {
          const message: DubbingMessage = {
            action: isDubbingActive ? "stopDubbing" : "initializeDubbing",
            movieId: selectedMovie?.imdbID || null,
            languageCode: selectedLanguage?.attributes.language || null,
            srtContent: srtContent,
            seasonNumber: selectedSeasonNumber || undefined,
            episodeNumber: selectedEpisodeNumber || undefined,
          };

          chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
            if (response && response.status === "initialized") {
              dispatch(updateDubbingState(true));
              resolve();
            } else if (response && response.status === "stopped") {
              dispatch(updateDubbingState(false));
              resolve();
            } else if (response && response.status === "alreadyInitialized") {
              console.log("Dubbing is already initialized");
              resolve();
            } else {
              reject(new Error("Failed to toggle dubbing"));
            }
          });
        } else {
          reject(new Error("No active tab found"));
        }
      });
    });
  }
);

export const searchMovies = createAsyncThunk(
  "movie/searchMovies",
  async (query: string, { rejectWithValue }) => {
    try {
      const url = await new Promise<string>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs[0]?.url || "");
        });
      });
      const params = { text: query, url };
      return await fetchMovies(params);
    } catch (error) {
      toast.error((error as Error).message);
      return rejectWithValue((error as Error).message);
    }
  }
);

export const checkDubbingStatus = createAsyncThunk(
  "movie/checkDubbingStatus",
  async (_, { dispatch }) => {
    try {
      const response = await sendMessageToActiveTab({
        action: "checkDubbingStatus",
      });
      if (response && response.status === "checked") {
        dispatch(updateDubbingState(response.isDubbingActive));
        return response.isDubbingActive;
      } else {
        const storage = (await chrome.storage.local.get("isDubbingActive")) as {
          isDubbingActive: boolean;
        };
        dispatch(updateDubbingState(storage.isDubbingActive));
        return storage.isDubbingActive;
      }
    } catch (error) {
      const storage = (await chrome.storage.local.get("isDubbingActive")) as {
        isDubbingActive: boolean;
      };
      dispatch(updateDubbingState(storage.isDubbingActive));
      return storage.isDubbingActive;
    }
  }
);

export const availableLanguages = (state: RootState) =>
  Array.isArray(state.movie.languages) ? state.movie.languages : [];

export const setSrtContentAndSave = createAsyncThunk(
  "movie/setSrtContentAndSave",
  async (content: string | null, { dispatch }) => {
    dispatch(setSrtContent(content));
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ srtContent: content }, () => {
        resolve();
      });
    });
  }
);

const movieSlice = createSlice({
  name: "movie",
  initialState,
  reducers: {
    setSrtContent: (state, action: PayloadAction<string | null>) => {
      state.srtContent = action.payload;
    },
    updateVideoVolumeWhilePlayingDubbing: (
      state,
      action: PayloadAction<number>
    ) => {
      state.videoVolumeWhilePlayingDubbing = action.payload;
    },
    setDubbingVolumeMultiplier: (state, action: PayloadAction<number>) => {
      state.dubbingVolumeMultiplier = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSelectedMovie: (state, action: PayloadAction<Movie | null>) => {
      if (!Array.isArray(state.languages)) {
        state.languages = Object.entries(languageCodes).map(([code, name]) => ({
          id: code,
          attributes: {
            language: code,
            language_name: name,
          },
        }));
      }
      if (state.isDubbingActive) {
        sendMessageToActiveTab({ action: "stopDubbing" });
      }
      state.selectedMovie = action.payload;
      state.selectedLanguage = null;
      state.isDubbingActive = false;
      state.subtitleOffset = 0;
      state.subtitlesLoaded = false;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSelectedLanguage: (state, action: PayloadAction<Language | null>) => {
      if (state.isDubbingActive) {
        sendMessageToActiveTab({ action: "stopDubbing" });
      }
      state.selectedLanguage = action.payload;
      state.isDubbingActive = false;
      state.subtitleOffset = 0;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSearchResults: (state, action: PayloadAction<Movie[]>) => {
      state.searchResults = action.payload;
    },
    updateDubbingState: (state, action: PayloadAction<boolean>) => {
      state.isDubbingActive = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSubtitleOffset: (state, action: PayloadAction<number>) => {
      state.subtitleOffset = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    resetSettings: (state) => {
      state.subtitleOffset = 0;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    updateLastSelectedLanguage: (state, action: PayloadAction<Language>) => {
      state.lastSelectedLanguage = action.payload;
    },
    setSelectedSeasonNumber: (state, action: PayloadAction<number | null>) => {
      state.selectedSeasonNumber = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSelectedEpisodeNumber: (state, action: PayloadAction<number | null>) => {
      state.selectedEpisodeNumber = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMovieState.fulfilled, (state, action) => {
        return {
          ...state,
          ...action.payload,
          subtitlesLoaded: !!action.payload.srtContent,
        };
      })
      .addCase(searchMovies.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(
        searchMovies.fulfilled,
        (state, action: PayloadAction<Movie[]>) => {
          state.isLoading = false;
          state.searchResults = action.payload;
        }
      )
      .addCase(searchMovies.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(checkDubbingStatus.rejected, (state) => {
        state.isDubbingActive = false;
      })
      .addCase(selectSubtitle.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(selectSubtitle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.subtitlesLoaded = true;
      })
      .addCase(selectSubtitle.rejected, (state, action) => {
        state.isLoading = false;
      })
      .addCase(setLastSelectedLanguage.fulfilled, (state, action) => {
        state.lastSelectedLanguage = action.payload;
      })
      .addCase(loadLastSelectedLanguage.fulfilled, (state, action) => {
        state.lastSelectedLanguage = action.payload;
      })
      .addCase(setDubbingVoice.fulfilled, (state, action) => {
        state.dubbingVoice = action.payload;
      });
  },
});

export const {
  setSelectedMovie,
  setSelectedLanguage,
  setSearchResults,
  updateDubbingState,
  setSubtitleOffset,
  resetSettings,
  setDubbingVolumeMultiplier,
  updateVideoVolumeWhilePlayingDubbing,
  setSrtContent,
  updateLastSelectedLanguage,
  setSelectedSeasonNumber,
  setSelectedEpisodeNumber,
} = movieSlice.actions;

export default movieSlice.reducer;
