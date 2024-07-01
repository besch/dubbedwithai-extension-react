import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { Movie } from "@/types";
import MovieItem from "./MovieItem";
import { Search } from "lucide-react";

interface MovieSearchProps {
  onSelectMovie: (movie: Movie) => void;
}

const MovieSearch: React.FC<MovieSearchProps> = ({ onSelectMovie }) => {
  const selectedMovie = useSelector(
    (state: RootState) => state.movie.selectedMovie
  );
  const [movieQuery, setMovieQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMovies = useCallback(async (text: string) => {
    console.log("Searching movies for:", text);
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = `${process.env.REACT_APP_BASE_API_URL}/api/search-movies`;
      console.log("API URL:", apiUrl);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      console.log("Response status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Received data:", data);
      setMovies(data.Search || []);
    } catch (error) {
      console.error("Error searching movies:", error);
      setError("Failed to search movies. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("MovieQuery changed:", movieQuery);
    if (movieQuery.length > 2) {
      // Removed the !selectedMovie condition
      console.log("Searching for movies...");
      const debounceTimer = setTimeout(() => {
        searchMovies(movieQuery);
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setMovies([]);
    }
  }, [movieQuery, searchMovies]);

  const handleSelectMovie = (movie: Movie) => {
    onSelectMovie(movie);
    setMovieQuery("");
    setMovies([]);
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
      {movies.length > 0 && ( // Removed the !selectedMovie condition
        <ul className="mt-2 max-h-60 overflow-y-auto">
          {movies.map((movie) => (
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
