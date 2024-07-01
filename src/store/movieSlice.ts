import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  languages: Language[];
  isDubbingActive: boolean;
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  languages: [],
  isDubbingActive: false,
};

const movieSlice = createSlice({
  name: "movie",
  initialState,
  reducers: {
    setSelectedMovie: (state, action: PayloadAction<Movie | null>) => {
      state.selectedMovie = action.payload;
    },
    setSelectedLanguage: (state, action: PayloadAction<Language | null>) => {
      state.selectedLanguage = action.payload;
    },
    setLanguages: (state, action: PayloadAction<Language[]>) => {
      state.languages = action.payload;
    },
    setIsDubbingActive: (state, action: PayloadAction<boolean>) => {
      state.isDubbingActive = action.payload;
    },
  },
});

export const {
  setSelectedMovie,
  setSelectedLanguage,
  setLanguages,
  setIsDubbingActive,
} = movieSlice.actions;

export default movieSlice.reducer;
