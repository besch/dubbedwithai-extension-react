// components/MovieSearchPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import MovieSearch from "@/components/MovieSearch";
import { useDispatch } from "react-redux";
import { setSelectedMovie } from "@/store/movieSlice";
import { Movie } from "@/types";
import PageLayout from "@/components/ui/PageLayout";

const MovieSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleMovieSelect = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    navigate("/language");
  };

  return (
    <PageLayout title="Search for a Movie">
      <MovieSearch onSelectMovie={handleMovieSelect} />
    </PageLayout>
  );
};

export default MovieSearchPage;
