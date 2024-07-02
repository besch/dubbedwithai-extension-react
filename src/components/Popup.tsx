import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { loadState, saveState } from "@/lib/storage";
import MovieSearch from "@/components/MovieSearch";
import LanguageSelector from "@/components/LanguageSelector";
import DubbingControls from "@/components/DubbingControls";
import {
  setSelectedMovie,
  setSelectedLanguage,
  setLanguages,
  setIsDubbingActive,
} from "@/store/movieSlice";
import { Movie, Language } from "@/types";
import { initiateGoogleAuth, getAuthToken, clearAuthToken } from "@/lib/auth";

const Popup: React.FC = () => {
  const dispatch = useDispatch();
  const { selectedMovie, selectedLanguage, languages, isDubbingActive } =
    useSelector((state: RootState) => state.movie);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadState().then((savedState) => {
      console.log("Loaded state:", savedState);
      if (savedState && savedState.movie) {
        dispatch(setSelectedMovie(savedState.movie.selectedMovie));
        dispatch(setSelectedLanguage(savedState.movie.selectedLanguage));
        dispatch(setLanguages(savedState.movie.languages));
        dispatch(setIsDubbingActive(savedState.movie.isDubbingActive));
      }
      setIsLoading(false);
    });

    checkAuthStatus();
  }, [dispatch]);

  useEffect(() => {
    if (!isLoading) {
      saveState({
        movie: { selectedMovie, selectedLanguage, languages, isDubbingActive },
      } as RootState);
    }
  }, [selectedMovie, selectedLanguage, languages, isDubbingActive, isLoading]);

  const checkAuthStatus = async () => {
    const token = await getAuthToken();
    setIsAuthenticated(!!token);
  };

  const handleLogin = async () => {
    try {
      await initiateGoogleAuth();
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    await clearAuthToken();
    setIsAuthenticated(false);
  };

  const handleMovieSelect = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    dispatch(setSelectedLanguage(null));
    dispatch(setLanguages([]));
    dispatch(setIsDubbingActive(false));
    getSubtitleLanguages(movie.imdbID);
  };

  const handleLanguageSelect = (language: Language) => {
    dispatch(setSelectedLanguage(language));
  };

  const handleDubbingToggle = (isActive: boolean) => {
    dispatch(setIsDubbingActive(isActive));
  };

  const getSubtitleLanguages = async (imdbID: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/opensubtitles/get-subtitle-languages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ imdbID }),
        }
      );
      const data = await response.json();
      dispatch(setLanguages(data.data || []));
    } catch (error) {
      console.error("Error getting subtitle languages:", error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4 w-[300px] h-[400px] bg-white rounded shadow-md">
      {isAuthenticated ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">Dubabase</h1>
            <button
              onClick={handleLogout}
              className="text-blue-500 hover:text-blue-700"
            >
              Logout
            </button>
          </div>
          <MovieSearch onSelectMovie={handleMovieSelect} />
          {selectedMovie && (
            <div className="mt-4">
              <h2 className="font-bold text-lg">{selectedMovie.Title}</h2>
              <p className="text-sm text-gray-600">{selectedMovie.Year}</p>
              {selectedMovie.Poster && selectedMovie.Poster !== "N/A" && (
                <img
                  src={selectedMovie.Poster}
                  alt={selectedMovie.Title}
                  className="w-24 h-36 object-cover mt-2"
                />
              )}
              <LanguageSelector onSelectLanguage={handleLanguageSelect} />
              <DubbingControls
                isDubbingActive={isDubbingActive}
                onDubbingToggle={handleDubbingToggle}
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="mb-4 text-xl font-bold">Welcome to Dubabase</h2>
          <p className="mb-4 text-center text-gray-600">
            Please log in to access the movie dubbing features.
          </p>
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200"
          >
            Login with Google
          </button>
        </div>
      )}
    </div>
  );
};

export default Popup;
