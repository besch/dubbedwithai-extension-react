import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MovieSearch from "@/components/MovieSearch";
import { useDispatch } from "react-redux";
import { setSelectedMovie, clearMovieErrors } from "@/store/movieSlice";
import { Movie } from "@/types";
import PageLayout from "@/components/ui/PageLayout";
import { useTranslation } from "react-i18next";

const MovieSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();

  useEffect(() => {
    dispatch(clearMovieErrors());
  }, [dispatch]);

  const handleMovieSelect = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    navigate("/language");
  };

  return (
    <PageLayout title={t("searchForMovie")}>
      <div className="h-full overflow-visible">
        <MovieSearch onSelectMovie={handleMovieSelect} />
      </div>
    </PageLayout>
  );
};

export default MovieSearchPage;
