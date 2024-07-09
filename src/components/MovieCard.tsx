import React from "react";
import { Movie } from "@/types";

interface MovieCardProps {
  movie: Movie;
}

const MovieCard: React.FC<MovieCardProps> = ({ movie }) => (
  <div className="flex items-start space-x-4">
    {movie.Poster && movie.Poster !== "N/A" ? (
      <img
        src={movie.Poster}
        alt={`${movie.Title} poster`}
        className="w-24 h-36 object-cover rounded-md shadow-sm"
      />
    ) : (
      <div className="w-24 h-36 bg-secondary flex items-center justify-center rounded-md shadow-sm">
        <span className="text-secondary-foreground text-xs text-center">
          No poster
        </span>
      </div>
    )}
    <div>
      <h3 className="font-semibold text-foreground">{movie.Title}</h3>
      <p className="text-sm text-muted-foreground">{movie.Year}</p>
    </div>
  </div>
);

export default MovieCard;
