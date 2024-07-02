// src/components/MovieSearch.tsx

import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { Movie } from "@/types";
import MovieItem from "./MovieItem";
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
          className="w-full p-2 pl-10 border rounded"
        />
        <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
      </div>
      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {searchResults.length > 0 && (
        <ul className="mt-2 max-h-60 overflow-y-auto">
          {searchResults.map((movie) => (
            <MovieItem
              key={movie.imdbID}
              movie={movie}
              onSelect={handleSelectMovie}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

export default MovieSearch;
