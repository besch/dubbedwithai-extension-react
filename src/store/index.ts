import { configureStore } from "@reduxjs/toolkit";
import movieReducer from "@/store/movieSlice";
import authReducer from "@/store/authSlice";
import languageSlice from "./languageSlice";

export const store = configureStore({
  reducer: {
    movie: movieReducer,
    language: languageSlice,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
