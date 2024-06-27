import React from "react";
import { Movie } from "@/types";

interface MovieItemProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}

const MovieItem: React.FC<MovieItemProps> = ({ movie, onSelect }) => (
  <li
    onClick={() => onSelect(movie)}
    className="cursor-pointer hover:bg-gray-100 p-1"
  >
    <div className="flex items-start space-x-6 bg-white rounded-lg shadow-md p-4">
      {movie.Poster && movie.Poster !== "N/A" ? (
        <img
          src={movie.Poster}
          alt={`${movie.Title} poster`}
          className="w-24 h-36 object-cover rounded-md shadow-sm"
        />
      ) : (
        <div className="w-24 h-36 bg-gray-200 flex items-center justify-center rounded-md shadow-sm">
          <span className="text-gray-500 text-xs text-center">
            No poster available
          </span>
        </div>
      )}
      <div className="flex flex-col justify-center">
        <h2 className="text-xl font-semibold text-gray-800">{movie.Title}</h2>
        <p className="text-sm text-gray-600 mt-1">({movie.Year})</p>
      </div>
    </div>
  </li>
);

export default MovieItem;
