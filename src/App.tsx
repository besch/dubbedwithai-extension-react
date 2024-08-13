import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import SubtitleCarousel from "@/components/SubtitleCarousel";
import FeedbackPage from "./pages/FeedbackPage";

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isExtended, setIsExtended] = useState(false);
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
    setIsExtended(isDubbingActive);
  }, [isDubbingActive]);

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

        // Check if the content script is already loaded
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => (window as any).__DUBBING_CONTENT_SCRIPT_LOADED__,
        });

        if (!result) {
          // If not loaded, inject the script
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ["content.js"],
          });
          console.log("Content script injected");
        } else {
          console.log("Content script already loaded");
        }
      } catch (error) {
        console.error("Error handling content script:", error);
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
      <div className="w-[350px] h-[600px] flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Router>
      <div
        className={`h-[600px] min-h-[600px] flex overflow-hidden transition-all duration-300 ease-in-out ${
          isExtended ? "w-[600px] min-w-[600px]" : "w-[350px] min-w-[350px]"
        }`}
      >
        <div className="w-[350px] h-full flex flex-col overflow-hidden">
          <div className="flex-grow h-[450px] bg-background text-foreground flex flex-col overflow-hidden">
            <Navigation />
            <div className="flex-grow overflow-auto">
              <Routes>
                <Route path="/search" element={<MovieSearchPage />} />
                <Route path="/language" element={<LanguageSelectionPage />} />
                <Route path="/dubbing" element={<DubbingPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route
                  path="*"
                  element={
                    isDubbingActive ? (
                      <Navigate to="/dubbing" replace />
                    ) : (
                      <Navigate to="/search" replace />
                    )
                  }
                />
              </Routes>
            </div>
          </div>
        </div>

        {isExtended && (
          <div className="w-[250px] h-full bg-secondary bg-opacity-75 transition-all duration-300 ease-in-out flex-shrink-0">
            <SubtitleCarousel />
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;
