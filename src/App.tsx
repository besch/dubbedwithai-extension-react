// App.tsx
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { checkAuthStatus } from "@/store/authSlice";
import { loadMovieState } from "@/store/movieSlice";
import AuthPage from "@/pages/AuthPage";
import MovieSearchPage from "@/pages/MovieSearchPage";
import LanguageSelectionPage from "@/pages/LanguageSelectionPage";
import DubbingPage from "@/pages/DubbingPage";
import Navigation from "@/pages/Navigation";

const AppContent: React.FC = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!isLoading && isAuthenticated && isDubbingActive) {
      navigate("/dubbing");
    }
  }, [isLoading, isAuthenticated, isDubbingActive, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
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
            isAuthenticated ? <DubbingPage /> : <Navigate to="/auth" replace />
          }
        />
        <Route
          path="*"
          element={
            <Navigate to={isAuthenticated ? "/search" : "/auth"} replace />
          }
        />
      </Routes>
    </>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <div className="w-[300px] h-[400px] bg-white rounded shadow-md">
        <AppContent />
      </div>
    </Router>
  );
};

export default App;
