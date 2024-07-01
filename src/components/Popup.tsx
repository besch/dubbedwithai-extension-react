import React, { useEffect } from "react";
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
} from "@/store/movieSlice";
import { Movie } from "@/types";

const Popup: React.FC = () => {
  const dispatch = useDispatch();
  const { selectedMovie, selectedLanguage, languages } = useSelector(
    (state: RootState) => state.movie
  );

  useEffect(() => {
    loadState().then((savedState) => {
      if (savedState && savedState.movie) {
        dispatch(setSelectedMovie(savedState.movie.selectedMovie));
        dispatch(setSelectedLanguage(savedState.movie.selectedLanguage));
        dispatch(setLanguages(savedState.movie.languages));
      }
    });
  }, [dispatch]);

  useEffect(() => {
    const saveStateToStorage = () => {
      saveState({
        movie: { selectedMovie, selectedLanguage, languages },
      } as RootState);
    };

    // Save state when component unmounts
    return saveStateToStorage;
  }, [selectedMovie, selectedLanguage, languages]);

  const handleMovieSelect = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    dispatch(setSelectedLanguage(null));
    dispatch(setLanguages([]));
    getSubtitleLanguages(movie.imdbID);
  };

  const getSubtitleLanguages = async (imdbID: string) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/opensubtitles/get-subtitle-languages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imdbID }),
        }
      );
      const data = await response.json();
      dispatch(setLanguages(data.data || []));
    } catch (error) {
      console.error("Error getting subtitle languages:", error);
    }
  };

  return (
    <div className="p-4 w-[300px] h-[400px] bg-white rounded shadow-md">
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
          <LanguageSelector />
          <DubbingControls />
        </div>
      )}
    </div>
  );
};

export default Popup;
