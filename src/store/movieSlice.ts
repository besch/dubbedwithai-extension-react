import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";
import { getAuthToken } from "@/lib/auth";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  languages: Language[];
  isDubbingActive: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  languages: [],
  isDubbingActive: false,
  isLoading: false,
  error: null,
};

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

const movieSlice = createSlice({
  name: "movie",
  initialState,
  reducers: {
    setSelectedMovie: (state, action: PayloadAction<Movie | null>) => {
      state.selectedMovie = action.payload;
      state.selectedLanguage = null;
      state.languages = [];
    },
    setSelectedLanguage: (state, action: PayloadAction<Language | null>) => {
      state.selectedLanguage = action.payload;
    },
    setIsDubbingActive: (state, action: PayloadAction<boolean>) => {
      state.isDubbingActive = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
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
      });
  },
});

export const { setSelectedMovie, setSelectedLanguage, setIsDubbingActive } =
  movieSlice.actions;

export default movieSlice.reducer;
