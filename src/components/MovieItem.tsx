// src/components/MovieItem.tsx

import React from "react";
import { Movie } from "@/types";

interface MovieItemProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}

const MovieItem: React.FC<MovieItemProps> = ({ movie, onSelect }) => (
  <li
    onClick={() => onSelect(movie)}
    className="cursor-pointer hover:bg-background transition duration-200 rounded-lg shadow-sm mb-2"
  >
    <div className="flex items-start space-x-4 p-4">
      {movie.Poster && movie.Poster !== "N/A" ? (
        <img
          src={movie.Poster}
          alt={`${movie.Title} poster`}
          className="w-24 h-36 object-cover rounded-md shadow-sm"
        />
      ) : (
        <div className="w-24 h-36 bg-gray-200 flex items-center justify-center rounded-md shadow-sm">
          <span className="text-gray-500 text-xs text-center">No poster</span>
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-primary">{movie.Title}</h2>
        <p className="text-sm text-gray-600">({movie.Year})</p>
      </div>
    </div>
  </li>
);

export default MovieItem;
