import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Language, Movie } from "@/types";

interface MovieState {
  selectedMovie: Movie | null;
  selectedLanguage: Language | null;
  languages: Language[];
  dubbingAvailable: boolean;
  isGenerating: boolean;
  isDubbingActive: boolean;
}

const initialState: MovieState = {
  selectedMovie: null,
  selectedLanguage: null,
  languages: [],
  dubbingAvailable: false,
  isGenerating: false,
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
    setDubbingAvailable: (state, action: PayloadAction<boolean>) => {
      state.dubbingAvailable = action.payload;
    },
    setIsGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload;
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
  setDubbingAvailable,
  setIsGenerating,
  setIsDubbingActive,
} = movieSlice.actions;

export default movieSlice.reducer;
