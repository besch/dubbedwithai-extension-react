import { toast } from "react-toastify";
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";
import { RootState } from "@/store/index";
import { sendMessageToActiveTab } from "@/lib/messaging";
import config from "@/extension/content/config";
import languageCodes from "@/lib/languageCodes";
import { DubbingMessage } from "@/types";
import { fetchMovies, fetchSubtitles } from "@/api";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  selectedSeasonNumber: number | null;
  selectedEpisodeNumber: number | null;
  srtContent: string | null;
  languages: Language[];
  isDubbingActive: boolean;
  searchResults: Movie[];
  subtitleOffset: number;
  currentVideoTime: number;
  adjustedVideoTime: number;
  dubbingVolumeMultiplier: number;
  videoVolumeWhilePlayingDubbing: number;
  subtitlesLoaded: boolean;
  lastSelectedLanguage: Language | null;
  error: string | null;
  isLoading: boolean;
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  selectedSeasonNumber: null,
  selectedEpisodeNumber: null,
  srtContent: null,
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
  currentVideoTime: 0,
  adjustedVideoTime: 0,
  dubbingVolumeMultiplier: 1.0,
  videoVolumeWhilePlayingDubbing: config.videoVolumeWhilePlayingDubbing,
  subtitlesLoaded: false,
  lastSelectedLanguage: null,
  error: null,
  isLoading: false,
};

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
      return console.error("No movie or language selected");
    }

    return dispatch(
      selectSubtitle({
        imdbID: selectedMovie.imdbID,
        languageCode: selectedLanguage.id,
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
    },
    { dispatch, getState }
  ) => {
    try {
      const state = getState() as RootState;
      const currentSrtContent = state.movie.srtContent;

      const data = await fetchSubtitles(params);

      if (!data.srtContent) {
        toast.error("No subtitles found for the selected language.");
        return null;
      }

      // Send subtitles to background script
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "setSubtitles",
            movieId: params.imdbID,
            languageCode: params.languageCode,
            subtitles: data.srtContent,
          },
          (response) => {
            if (response && response.status === "success") {
              resolve();
            } else {
              reject(new Error("Failed to set subtitles in background script"));
            }
          }
        );
      });

      // Update srtContent only if it's different from the current one
      if (data.srtContent !== currentSrtContent) {
        dispatch(setSrtContent(data.srtContent));
        await chrome.storage.local.set({ srtContent: data.srtContent });
      }

      return data.subtitleInfo;
    } catch (error) {
      toast.error("An error occurred while fetching subtitles.");
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
    chrome.storage.local.get(["movieState"], (result) => {
      const movieState = result.movieState || {};
      if (typeof movieState.subtitleOffset !== "number") {
        movieState.subtitleOffset = 0;
      }
      if (typeof movieState.videoVolumeWhilePlayingDubbing !== "number") {
        movieState.videoVolumeWhilePlayingDubbing =
          config.videoVolumeWhilePlayingDubbing;
      }
      resolve(movieState);
    });
  });
});

export const toggleDubbingProcess = createAsyncThunk(
  "movie/toggleDubbingProcess",
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const { selectedMovie, selectedLanguage, isDubbingActive, srtContent } =
      state.movie;

    if (!srtContent && (!selectedMovie || !selectedLanguage)) {
      throw new Error(
        "No subtitles uploaded and no movie or language selected"
      );
    }

    return new Promise<void>((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]?.id) {
          const message: DubbingMessage = {
            action: isDubbingActive ? "stopDubbing" : "initializeDubbing",
            movieId: selectedMovie?.imdbID || "uploaded",
            languageCode: selectedLanguage?.attributes.language || "uploaded",
            srtContent: srtContent,
            seasonNumber: state.movie.selectedSeasonNumber || undefined,
            episodeNumber: state.movie.selectedEpisodeNumber || undefined,
          };

          chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
            if (response && response.status === "success") {
              dispatch(updateDubbingState(!isDubbingActive));
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
      return await fetchMovies(query);
    } catch (error) {
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
      console.error("Failed to check dubbing status:", error);
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

const movieSlice = createSlice({
  name: "movie",
  initialState,
  reducers: {
    setSrtContent: (state, action: PayloadAction<string | null>) => {
      state.srtContent = action.payload;
      state.subtitlesLoaded = !!action.payload;
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
      chrome.storage.local.set({ movieState: { ...state } });
      state.subtitlesLoaded = false;
      state.srtContent = null;
    },
    setSelectedLanguage: (state, action: PayloadAction<Language | null>) => {
      if (state.isDubbingActive) {
        sendMessageToActiveTab({ action: "stopDubbing" });
      }
      state.selectedLanguage = action.payload;
      state.isDubbingActive = false;
      state.subtitleOffset = 0;
      chrome.storage.local.set({ movieState: { ...state } });
      state.srtContent = null;
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
    updateCurrentTime: (
      state,
      action: PayloadAction<{ currentTime: number; adjustedTime: number }>
    ) => {
      state.currentVideoTime = action.payload.currentTime;
      state.adjustedVideoTime = action.payload.adjustedTime;
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
    clearMovieErrors: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMovieState.fulfilled, (state, action) => {
        return { ...state, ...action.payload };
      })
      .addCase(searchMovies.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        searchMovies.fulfilled,
        (state, action: PayloadAction<Movie[]>) => {
          state.isLoading = false;
          state.searchResults = action.payload;
        }
      )
      .addCase(searchMovies.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(toggleDubbingProcess.rejected, (state, action) => {
        state.error =
          action.error.message || "Failed to toggle dubbing process";
      })
      .addCase(checkDubbingStatus.rejected, (state) => {
        state.isDubbingActive = false;
      })
      .addCase(selectSubtitle.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(selectSubtitle.fulfilled, (state, action) => {
        state.isLoading = false;
        state.selectedLanguage = action.payload;
        state.subtitlesLoaded = true;
      })
      .addCase(selectSubtitle.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to select subtitle";
      })
      .addCase(setLastSelectedLanguage.fulfilled, (state, action) => {
        state.lastSelectedLanguage = action.payload;
      })
      .addCase(loadLastSelectedLanguage.fulfilled, (state, action) => {
        state.lastSelectedLanguage = action.payload;
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
  updateCurrentTime,
  setDubbingVolumeMultiplier,
  updateVideoVolumeWhilePlayingDubbing,
  setSrtContent,
  updateLastSelectedLanguage,
  setSelectedSeasonNumber,
  setSelectedEpisodeNumber,
  clearMovieErrors,
} = movieSlice.actions;

export default movieSlice.reducer;
