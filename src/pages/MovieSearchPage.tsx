// components/MovieSearchPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import MovieSearch from "@/components/MovieSearch";
import { useDispatch } from "react-redux";
import { setSelectedMovie } from "@/store/movieSlice";
import { Movie } from "@/types";

const MovieSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleMovieSelect = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    navigate("/language");
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Search for a Movie</h2>
      <MovieSearch onSelectMovie={handleMovieSelect} />
    </div>
  );
};

export default MovieSearchPage;
