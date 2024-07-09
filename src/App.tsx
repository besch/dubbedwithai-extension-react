// src/App.tsx

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
import { loadMovieState } from "@/store/movieSlice";
import AuthPage from "@/pages/AuthPage";
import MovieSearchPage from "@/pages/MovieSearchPage";
import LanguageSelectionPage from "@/pages/LanguageSelectionPage";
import DubbingPage from "@/pages/DubbingPage";
import ProfilePage from "@/pages/ProfilePage";
import Navigation from "@/pages/Navigation";
import SettingsPage from "./pages/SettingsPage";

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const isDubbingActive = useSelector(
    (state: RootState) => state.movie.isDubbingActive
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      await dispatch(checkAuthStatus());
      await dispatch(loadMovieState());
      setIsLoading(false);
    };

    initializeApp();
  }, [dispatch]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="w-[350px] h-[400px] bg-white rounded shadow-md">
        <Navigation />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/search"
            element={
              isAuthenticated ? (
                <MovieSearchPage />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/language"
            element={
              isAuthenticated ? (
                <LanguageSelectionPage />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/dubbing"
            element={
              isAuthenticated ? (
                <DubbingPage />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/profile"
            element={
              isAuthenticated ? (
                <ProfilePage />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/settings"
            element={
              isAuthenticated ? (
                <SettingsPage />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="*"
            element={
              isAuthenticated ? (
                isDubbingActive ? (
                  <Navigate to="/dubbing" replace />
                ) : (
                  <Navigate to="/search" replace />
                )
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
