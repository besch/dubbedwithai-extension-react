import { configureStore } from "@reduxjs/toolkit";
import movieReducer from "@/store/movieSlice";
import authReducer from "@/store/authSlice";

export const store = configureStore({
  reducer: {
    movie: movieReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
