import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  initiateGoogleAuth,
  getAuthToken,
  clearAuthToken,
} from "@/extension/auth";

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  loading: false,
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async (_, { rejectWithValue }) => {
    try {
      const token = await initiateGoogleAuth();
      return token;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await clearAuthToken();
});

export const checkAuthStatus = createAsyncThunk(
  "auth/checkStatus",
  async () => {
    const token = await getAuthToken();
    return token;
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.token = action.payload;
        state.loading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.token = null;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isAuthenticated = !!action.payload;
        state.token = action.payload;
      });
  },
});

export default authSlice.reducer;
