import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { Movie } from "@/types";
import MovieItem from "@/components/MovieItem";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search, X } from "lucide-react";
import { searchMovies, setSelectedMovie } from "@/store/movieSlice";

interface MovieSearchProps {
  onSelectMovie: (movie: Movie) => void;
}

const MovieSearch: React.FC<MovieSearchProps> = ({ onSelectMovie }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { searchResults, isLoading, error } = useSelector(
    (state: RootState) => state.movie
  );
  const [movieQuery, setMovieQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleSearch = useCallback(
    async (query: string) => {
      if (query.length > 2) {
        dispatch(searchMovies(query));
      }
    },
    [dispatch]
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

  return (
    <div className="mb-4">
      <div className="relative">
        <label htmlFor="movie-search" className="sr-only">
          Search for a movie
        </label>
        <input
          id="movie-search"
          type="text"
          value={movieQuery}
          onChange={(e) => setMovieQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for a movie"
          className="w-full p-2 pl-10 pr-10 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Search for a movie"
        />
        <Search
          className={`absolute left-3 top-2.5 text-muted-foreground"
          }`}
          size={20}
        />
        {movieQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X size={20} />
          </button>
        )}
      </div>
      {isLoading && (
        <div className="flex justify-center items-center mt-8">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {error && <p className="text-destructive mt-2">{error}</p>}
      {searchResults && searchResults.length > 0 ? (
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
      ) : (
        <>
          {movieQuery.length > 2 && !isLoading && !error && (
            <p className="mt-2 text-muted-foreground">
              No movies found. Try another search term.
            </p>
          )}
          {!movieQuery.length && !isLoading && !error && (
            <p className="mt-2 text-muted-foreground">
              Start typing to search for movies.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default MovieSearch;
