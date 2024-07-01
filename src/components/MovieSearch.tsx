import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (movieQuery.length > 2 && !selectedMovie) {
      searchMovies(movieQuery);
    } else {
      setMovies([]);
    }
  }, [movieQuery, selectedMovie]);

  const searchMovies = async (text: string) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/search-movies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }
      );
      const data = await response.json();
      setMovies(data.Search || []);
    } catch (error) {
      console.error("Error searching movies:", error);
    }
  };

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
      {!selectedMovie && movies.length > 0 && (
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
