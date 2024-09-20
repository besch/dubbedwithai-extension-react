import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import i18n from "@/i18n";
import { toast } from "react-toastify";

interface LanguageState {
  currentLanguage: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: LanguageState = {
  currentLanguage: "en",
  isLoading: false,
  error: null,
};

export const changeLanguage = createAsyncThunk(
  "language/changeLanguage",
  async (language: string, { rejectWithValue }) => {
    try {
      await i18n.changeLanguage(language);
      await chrome.storage.local.set({ appLanguage: language });
      return language;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const loadSavedLanguage = createAsyncThunk(
  "language/loadSavedLanguage",
  async (_, { dispatch }) => {
    return new Promise<string>((resolve) => {
      chrome.storage.local.get(["appLanguage"], (result) => {
        const savedLanguage = result.appLanguage;
        if (savedLanguage) {
          dispatch(changeLanguage(savedLanguage));
        }
        resolve(savedLanguage || "en");
      });
    });
  }
);

const languageSlice = createSlice({
  name: "language",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(changeLanguage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(
        changeLanguage.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.isLoading = false;
          state.currentLanguage = action.payload;
        }
      )
      // .addCase(changeLanguage.rejected, (state, action) => {
      //   state.isLoading = false;
      //   state.error = action.payload as string;
      //   toast.error("Failed to change language");
      // })
      .addCase(
        loadSavedLanguage.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.currentLanguage = action.payload;
        }
      );
  },
});

export default languageSlice.reducer;
