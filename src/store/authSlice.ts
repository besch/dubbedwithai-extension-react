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
  authChecked: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  loading: false,
  error: null,
  authChecked: false,
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
    return new Promise<string | null>((resolve) => {
      chrome.storage.local.get(["authToken"], (result) => {
        if (result.authToken) {
          resolve(result.authToken);
        } else {
          chrome.runtime.sendMessage({ action: "checkAuthStatus" }, () => {
            chrome.storage.local.get(["authToken"], (updatedResult) => {
              resolve(updatedResult.authToken || null);
            });
          });
        }
      });
    });
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isAuthenticated = !!action.payload;
        state.token = action.payload;
        state.loading = false;
        state.authChecked = true;
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
        state.authChecked = true;
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.token = action.payload;
        state.loading = false;
        chrome.storage.local.set({ authToken: action.payload });
      })
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.token = null;
        chrome.storage.local.remove(["authToken"]);
      });
  },
});

export default authSlice.reducer;
