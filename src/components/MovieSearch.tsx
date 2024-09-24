import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { Movie } from "@/types";
import MovieItem from "@/components/MovieItem";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, X } from "lucide-react";
import {
  searchMovies,
  setSearchResults,
  setSelectedMovie,
} from "@/store/movieSlice";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

interface MovieSearchProps {
  onSelectMovie: (movie: Movie) => void;
  onSearchInputChange: (input: string) => void;
}

const MovieSearch: React.FC<MovieSearchProps> = ({
  onSelectMovie,
  onSearchInputChange,
}) => {
  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const { searchResults, isLoading } = useSelector(
    (state: RootState) => state.movie
  );
  const [movieQuery, setMovieQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    dispatch(setSearchResults([]));
  }, [dispatch]);

  const handleSearch = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length > 2) {
        const results = await dispatch(searchMovies(trimmedQuery)).unwrap();
        if (results.length === 0) {
          toast.error(t("noMoviesFound"));
        }
      }
    },
    [dispatch, t]
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleSearch(movieQuery);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [movieQuery, handleSearch]);

  const handleSelectMovie = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    onSelectMovie(movie);
    setMovieQuery("");
    setSelectedIndex(-1);
  };

  const handleClearSearch = () => {
    setMovieQuery("");
    setSelectedIndex(-1);
    dispatch(setSearchResults([]));
    onSearchInputChange("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prevIndex) =>
        Math.min(prevIndex + 1, searchResults.length - 1)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prevIndex) => Math.max(prevIndex - 1, -1));
    } else if (e.key === "Enter" && selectedIndex !== -1) {
      handleSelectMovie(searchResults[selectedIndex]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setMovieQuery(newValue);
    onSearchInputChange(newValue);
  };

  return (
    <div className="mb-4">
      <div className="relative">
        <label htmlFor="movie-search" className="sr-only">
          {t("searchForMovie")}
        </label>
        <input
          id="movie-search"
          type="text"
          value={movieQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={t("searchForMovie")}
          className="w-full p-2 pl-10 pr-10 border rounded bg-background text-foreground border-muted-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          aria-label={t("searchForMovie")}
        />
        <Search
          className={`absolute left-3 top-2.5 text-muted-foreground`}
          size={20}
        />
        {movieQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label={t("clearSearch")}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <p className="mt-2 text-muted-foreground">{t("startTyping")}</p>
      {isLoading && (
        <div className="flex justify-center items-center mt-8">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {searchResults && searchResults.length > 0 && (
        <ul className="mt-2">
          {searchResults.map((movie, index) => (
            <MovieItem
              key={movie.imdbID}
              movie={movie}
              onSelect={handleSelectMovie}
              isSelected={index === selectedIndex}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default MovieSearch;
