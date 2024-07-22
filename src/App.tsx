import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { checkAuthStatus } from "@/store/authSlice";
import {
  loadMovieState,
  updateDubbingState,
  checkDubbingStatus,
} from "@/store/movieSlice";
import AuthPage from "@/pages/AuthPage";
import MovieSearchPage from "@/pages/MovieSearchPage";
import LanguageSelectionPage from "@/pages/LanguageSelectionPage";
import DubbingPage from "@/pages/DubbingPage";
import ProfilePage from "@/pages/ProfilePage";
import Navigation from "@/pages/Navigation";
import SettingsPage from "@/pages/SettingsPage";
import CurrentSubtitle from "@/components/CurrentSubtitle";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { isDubbingActive } = useSelector((state: RootState) => state.movie);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // await dispatch(checkAuthStatus());
      await dispatch(loadMovieState());
      await dispatch(checkDubbingStatus());
      setIsLoading(false);
    };

    initializeApp();
  }, [dispatch]);

  useEffect(() => {
    const loadContentScript = async () => {
      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (!tab.id) {
          console.error("No active tab found");
          return;
        }

        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["content.js"],
        });
      } catch (error) {
        console.error("Error loading content script:", error);
      }
    };

    loadContentScript();
  }, []);

  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.action === "updateDubbingState") {
        dispatch(updateDubbingState(message.payload));
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [dispatch]);

  if (isLoading) {
    return (
      <div
        className={`w-[350px] h-[450px] flex items-center justify-center bg-background`}
      >
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Router>
      <div
        className={`w-[350px] h-[430px] bg-background text-foreground flex flex-col`}
      >
        <Navigation />
        <div className="flex-grow overflow-auto">
          <Routes>
            {/* <Route path="/auth" element={<AuthPage />} /> */}
            <Route
              path="/search"
              element={
                // isAuthenticated ? (
                <MovieSearchPage />
                // ) : (
                // <Navigate to="/auth" replace />
                // )
              }
            />
            <Route
              path="/language"
              element={
                // isAuthenticated ? (
                <LanguageSelectionPage />
                // ) : (
                // <Navigate to="/auth" replace />
                // )
              }
            />
            <Route
              path="/dubbing"
              element={
                // isAuthenticated ? (
                <DubbingPage />
                // ) : (
                // <Navigate to="/auth" replace />
                // )
              }
            />
            <Route
              path="/profile"
              element={
                // isAuthenticated ? (
                <ProfilePage />
                // ) : (
                // <Navigate to="/auth" replace />
                // )
              }
            />
            <Route
              path="/settings"
              element={
                // isAuthenticated ? (
                <SettingsPage />
                // ) : (
                // <Navigate to="/auth" replace />
                // )
              }
            />
            <Route
              path="*"
              element={
                // isAuthenticated ? (
                isDubbingActive ? (
                  <Navigate to="/dubbing" replace />
                ) : (
                  <Navigate to="/search" replace />
                )
                // ) : (
                //   <Navigate to="/auth" replace />
                // )
              }
            />
          </Routes>
        </div>
        <CurrentSubtitle />
      </div>
    </Router>
  );
};

export default App;
