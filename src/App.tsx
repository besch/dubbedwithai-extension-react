// App.tsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { checkAuthStatus } from "@/store/authSlice";
import AuthPage from "@/pages/AuthPage";
import MovieSearchPage from "@/pages/MovieSearchPage";
import LanguageSelectionPage from "@/pages/LanguageSelectionPage";
import DubbingPage from "@/pages/DubbingPage";
import Navigation from "@/pages/Navigation";

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );
  const authChecked = useSelector((state: RootState) => state.auth.authChecked);

  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

  if (!authChecked) {
    // You might want to show a loading spinner here
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="w-[300px] h-[400px] bg-white rounded shadow-md">
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
            path="*"
            element={
              <Navigate to={isAuthenticated ? "/search" : "/auth"} replace />
            }
          />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
