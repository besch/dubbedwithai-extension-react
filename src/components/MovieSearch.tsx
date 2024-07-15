import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { Movie } from "@/types";
import MovieItem from "@/components/MovieItem";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Search } from "lucide-react";
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
  };

  return (
    <div className="mb-4">
      <div className="relative">
        <input
          type="text"
          value={movieQuery}
          onChange={(e) => setMovieQuery(e.target.value)}
          placeholder="Search for a movie"
          className="w-full p-2 pl-10 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Search
          className="absolute left-3 top-2.5 text-muted-foreground"
          size={20}
        />
      </div>
      {isLoading && (
        <div className="flex justify-center items-center mt-4">
          <LoadingSpinner />
        </div>
      )}
      {error && <p className="text-destructive mt-2">{error}</p>}
      {searchResults && searchResults.length > 0 ? (
        <ul className="mt-2 max-h-60 overflow-y-auto">
          {searchResults.map((movie) => (
            <MovieItem
              key={movie.imdbID}
              movie={movie}
              onSelect={handleSelectMovie}
            />
          ))}
        </ul>
      ) : (
        movieQuery.length > 2 &&
        !isLoading &&
        !error && (
          <p className="mt-2 text-muted-foreground">
            No movies found. Try another search term.
          </p>
        )
      )}
    </div>
  );
};

export default MovieSearch;
