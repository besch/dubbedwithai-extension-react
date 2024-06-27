import React, { useState, useEffect } from "react";
import { Movie } from "@/types";
import MovieItem from "./MovieItem";

interface MovieSearchProps {
  onSelectMovie: (movie: Movie) => void;
  selectedMovie: Movie | null;
}

const MovieSearch: React.FC<MovieSearchProps> = ({
  onSelectMovie,
  selectedMovie,
}) => {
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
      const response = await fetch("http://localhost:3000/api/search-movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
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
    <div>
      <input
        type="text"
        value={movieQuery}
        onChange={(e) => setMovieQuery(e.target.value)}
        placeholder="Search for a movie"
        className="w-full p-2 border rounded"
      />
      {!selectedMovie && movies.length > 0 && (
        <ul className="mt-2">
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
