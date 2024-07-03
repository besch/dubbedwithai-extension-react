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
  user: {
    name: string;
    email: string;
  } | null;
  authChecked: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  loading: false,
  error: null,
  user: null,
  authChecked: false,
};

export async function fetchUserInfo(
  token: string
): Promise<{ name: string; email: string }> {
  try {
    const response = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      name: data.name,
      email: data.email,
    };
  } catch (error) {
    console.error("Error fetching user info:", error);
    throw error;
  }
}

export const login = createAsyncThunk(
  "auth/login",
  async (_, { rejectWithValue }) => {
    try {
      const token = await initiateGoogleAuth();
      const userInfo = await fetchUserInfo(token);
      return { token, user: userInfo };
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
  async (_, { dispatch }) => {
    const token = await getAuthToken();
    if (token) {
      const userInfo = await fetchUserInfo(token);
      return { token, user: userInfo };
    }
    return null;
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
        if (action.payload) {
          state.isAuthenticated = true;
          state.token = action.payload.token;
          state.user = action.payload.user;
        } else {
          state.isAuthenticated = false;
          state.token = null;
          state.user = null;
        }
        state.loading = false;
        state.authChecked = true;
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
        state.authChecked = true; // You might want to set this to true even if the check fails
      })
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.loading = false;
        chrome.storage.local.set({ authToken: action.payload.token });
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        chrome.storage.local.remove(["authToken"]);
      });
  },
});

export default authSlice.reducer;
