import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";
import { getAuthToken } from "@/extension/auth";
import { RootState } from "@/store/index";
import { sendMessageToActiveTab } from "@/lib/messaging";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  languages: Language[];
  isDubbingActive: boolean;
  isLoading: boolean;
  error: string | null;
  searchResults: Movie[];
  subtitleOffset: number;
  currentVideoTime: number;
  adjustedVideoTime: number;
  dubbingVolumeMultiplier: number;
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  languages: [],
  isDubbingActive: false,
  isLoading: false,
  error: null,
  searchResults: [],
  subtitleOffset: 0,
  currentVideoTime: 0,
  adjustedVideoTime: 0,
  dubbingVolumeMultiplier: 1.0,
};

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
    const { selectedMovie, selectedLanguage } = state.movie;

    if (!selectedMovie || !selectedLanguage) {
      throw new Error("No movie or language selected");
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "initializeDubbing",
            movieId: selectedMovie.imdbID,
            subtitleId: selectedLanguage.id,
          },
          (response) => {
            if (response && response.status === "initialized") {
              dispatch(updateDubbingState(true));
            }
          }
        );
      }
    });
  }
);

export const fetchLanguages = createAsyncThunk(
  "movie/fetchLanguages",
  async (imdbID: string, { rejectWithValue }) => {
    try {
      // const token = await getAuthToken();
      // if (!token) {
      //   throw new Error("No auth token available");
      // }
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/opensubtitles/get-subtitle-languages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ imdbID }),
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch languages");
      }
      const data = await response.json();
      return data.data as Language[];
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
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

const movieSlice = createSlice({
  name: "movie",
  initialState,
  reducers: {
    setDubbingVolumeMultiplier: (state, action: PayloadAction<number>) => {
      state.dubbingVolumeMultiplier = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSelectedMovie: (state, action: PayloadAction<Movie | null>) => {
      if (state.isDubbingActive) {
        sendMessageToActiveTab({ action: "stopDubbing" });
      }
      state.selectedMovie = action.payload;
      state.selectedLanguage = null;
      state.languages = [];
      state.isDubbingActive = false;
      state.subtitleOffset = 0;
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
      .addCase(fetchLanguages.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        fetchLanguages.fulfilled,
        (state, action: PayloadAction<Language[]>) => {
          state.isLoading = false;
          state.languages = action.payload;
        }
      )
      .addCase(fetchLanguages.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
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
} = movieSlice.actions;

export default movieSlice.reducer;
