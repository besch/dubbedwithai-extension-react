import React from "react";
import { Movie } from "@/types";

interface MovieItemProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  isSelected?: boolean;
}

const MovieItem: React.FC<MovieItemProps> = ({
  movie,
  onSelect,
  isSelected = false,
}) => (
  <li
    onClick={() => onSelect(movie)}
    className={`cursor-pointer transition duration-200 rounded-lg shadow-sm mb-2 ${
      isSelected
        ? "bg-accent bg-opacity-20"
        : "hover:bg-accent hover:bg-opacity-60"
    }`}
  >
    <div className="flex items-start space-x-4 p-4">
      {movie.Poster && movie.Poster !== "N/A" ? (
        <img
          src={movie.Poster}
          alt={`${movie.Title} poster`}
          className="w-24 h-36 object-cover rounded-md shadow-sm"
        />
      ) : (
        <div className="w-24 h-36 bg-muted flex items-center justify-center rounded-md shadow-sm">
          <span className="text-muted-foreground text-xs text-center">
            No poster
          </span>
        </div>
      )}
      <div>
        <h2 className="text-lg font-semibold text-foreground">{movie.Title}</h2>
        <p className="text-sm text-muted-foreground">({movie.Year})</p>
      </div>
    </div>
  </li>
);

export default MovieItem;
