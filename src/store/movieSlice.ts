import { toast } from "react-toastify";
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";
import { getAuthToken } from "@/extension/auth";
import { RootState } from "@/store/index";
import { sendMessageToActiveTab } from "@/lib/messaging";
import config from "@/extension/content/config";
import languageCodes from "@/lib/languageCodes";
import { DubbingMessage } from "@/extension/content/types";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  srtContent: string | null;
  languages: Language[];
  isDubbingActive: boolean;
  isLoading: boolean;
  error: string | null;
  searchResults: Movie[];
  subtitleOffset: number;
  currentVideoTime: number;
  adjustedVideoTime: number;
  dubbingVolumeMultiplier: number;
  videoVolumeWhilePlayingDubbing: number;
  subtitlesLoaded: boolean;
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  srtContent: null,
  languages: Object.entries(languageCodes).map(([code, name]) => ({
    id: code,
    attributes: {
      language: code,
      language_name: name,
    },
  })),
  isDubbingActive: false,
  isLoading: false,
  error: null,
  searchResults: [],
  subtitleOffset: 0,
  currentVideoTime: 0,
  adjustedVideoTime: 0,
  dubbingVolumeMultiplier: 1.0,
  videoVolumeWhilePlayingDubbing: config.videoVolumeWhilePlayingDubbing,
  subtitlesLoaded: false,
};

export const loadSubtitles = createAsyncThunk(
  "movie/loadSubtitles",
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const { selectedMovie, selectedLanguage } = state.movie;

    if (!selectedMovie || !selectedLanguage) {
      throw new Error("No movie or language selected");
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
    { imdbID, languageCode }: { imdbID: string; languageCode: string },
    { dispatch }
  ) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/opensubtitles/fetch-subtitles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imdbID, languageCode }),
        }
      );

      if (!response.ok) {
        toast.error("No subtitles found for the selected language.");
        return null;
      }

      const data = await response.json();

      if (!data.srtContent) {
        toast.error("No subtitles found for the selected language.");
        return null;
      }

      // Send subtitles to background script
      await new Promise<void>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "setSubtitles",
            movieId: imdbID,
            subtitleId: data.subtitleInfo.id,
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

      if (data.srtContent) {
        dispatch(setSrtContent(data.srtContent));
        await chrome.storage.local.set({ srtContent: data.srtContent });
      }

      return {
        id: data.subtitleInfo.id,
        attributes: {
          language: languageCode,
          language_name: data.subtitleInfo.attributes.language,
        },
      };
    } catch (error) {
      toast.error("An error occurred while fetching subtitles.");
      return null;
    }
  }
);

export const setVideoVolumeWhilePlayingDubbing = createAsyncThunk(
  "movie/setVideoVolumeWhilePlayingDubbing",
  async (volume: number, { dispatch }) => {
    await chrome.storage.local.set({ videoVolumeWhilePlayingDubbing: volume });
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
      resolve(movieState);
    });
  });
});

export const startDubbingProcess = createAsyncThunk(
  "movie/startDubbingProcess",
  async (_, { getState, dispatch }) => {
    const state = getState() as RootState;
    const { selectedMovie, selectedLanguage, srtContent } = state.movie;

    if (!selectedMovie || !selectedLanguage) {
      throw new Error("No movie or language selected");
    }

    return new Promise<void>((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "initializeDubbing",
              movieId: selectedMovie.imdbID,
              subtitleId: selectedLanguage.id,
              srtContent: srtContent,
            } as DubbingMessage,
            (response) => {
              if (response && response.status === "initialized") {
                dispatch(updateDubbingState(true));
                resolve();
              } else {
                reject(new Error("Failed to initialize dubbing"));
              }
            }
          );
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
      // const token = await getAuthToken();
      // if (!token) {
      //   throw new Error("No auth token available");
      // }
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/search-movies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: query }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to search movies");
      }
      const data = await response.json();
      return data.Search as Movie[];
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
      }
    } catch (error) {
      console.error("Failed to check dubbing status:", error);
      dispatch(updateDubbingState(false));
    }
  }
);

export const selectLanguages = (state: RootState) =>
  Array.isArray(state.movie.languages) ? state.movie.languages : [];

const movieSlice = createSlice({
  name: "movie",
  initialState,
  reducers: {
    setSrtContent: (state, action: PayloadAction<string>) => {
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
    resetSubtitleOffset: (state) => {
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
      .addCase(startDubbingProcess.rejected, (state, action) => {
        state.error = action.error.message || "Failed to start dubbing process";
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
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedMovie,
  setSelectedLanguage,
  setSearchResults,
  updateDubbingState,
  setSubtitleOffset,
  resetSubtitleOffset,
  updateCurrentTime,
  setDubbingVolumeMultiplier,
  updateVideoVolumeWhilePlayingDubbing,
  setSrtContent,
} = movieSlice.actions;

export default movieSlice.reducer;
