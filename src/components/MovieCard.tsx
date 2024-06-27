import { Movie } from "@/types";

const MovieCard: React.FC<{ movie: Movie }> = ({ movie }) => (
  <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 bg-white rounded-lg shadow-md p-4">
    {movie.Poster && (
      <img
        src={movie.Poster}
        alt={`${movie.Title} poster`}
        className="w-24 h-auto object-cover rounded-md shadow-sm"
      />
    )}
    <div className="flex flex-col justify-center">
      <h2 className="text-xl font-semibold text-gray-800">{movie.Title}</h2>
      <p className="text-sm text-gray-600 mt-1">({movie.Year})</p>
    </div>
  </div>
);

export default MovieCard;
