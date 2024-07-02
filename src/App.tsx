// App.tsx
import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import AuthPage from "@/pages/AuthPage";
import MovieSearchPage from "@/pages/MovieSearchPage";
import LanguageSelectionPage from "@/pages/LanguageSelectionPage";
import DubbingPage from "@/pages/DubbingPage";
import Navigation from "@/pages/Navigation";

const App: React.FC = () => {
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  return (
    <Router>
      <div className="w-[300px] h-[400px] bg-white rounded shadow-md">
        <Navigation />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/search" element={<MovieSearchPage />} />
          <Route path="/language" element={<LanguageSelectionPage />} />
          <Route path="/dubbing" element={<DubbingPage />} />
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
