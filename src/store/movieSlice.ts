import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";
import { getAuthToken } from "@/extension/auth";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  languages: Language[];
  isDubbingActive: boolean;
  isLoading: boolean;
  error: string | null;
  searchResults: Movie[];
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  languages: [],
  isDubbingActive: false,
  isLoading: false,
  error: null,
  searchResults: [],
};

export const loadMovieState = createAsyncThunk("movie/loadState", async () => {
  return new Promise<Partial<MovieState>>((resolve) => {
    chrome.storage.local.get(["movieState"], (result) => {
      resolve(result.movieState || {});
    });
  });
});

export const fetchLanguages = createAsyncThunk(
  "movie/fetchLanguages",
  async (imdbID: string, { rejectWithValue }) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("No auth token available");
      }
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/opensubtitles/get-subtitle-languages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
      const token = await getAuthToken();
      if (!token) {
        throw new Error("No auth token available");
      }
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/search-movies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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

const movieSlice = createSlice({
  name: "movie",
  initialState,
  reducers: {
    setSelectedMovie: (state, action: PayloadAction<Movie | null>) => {
      state.selectedMovie = action.payload;
      state.selectedLanguage = null;
      state.languages = [];
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSelectedLanguage: (state, action: PayloadAction<Language | null>) => {
      state.selectedLanguage = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setIsDubbingActive: (state, action: PayloadAction<boolean>) => {
      state.isDubbingActive = action.payload;
      chrome.storage.local.set({ movieState: { ...state } });
    },
    setSearchResults: (state, action: PayloadAction<Movie[]>) => {
      state.searchResults = action.payload;
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
      });
  },
});

export const {
  setSelectedMovie,
  setSelectedLanguage,
  setIsDubbingActive,
  setSearchResults,
} = movieSlice.actions;

export default movieSlice.reducer;
