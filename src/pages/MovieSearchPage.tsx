import React from "react";
import { useNavigate } from "react-router-dom";
import MovieSearch from "@/components/MovieSearch";
import SubtitleUpload from "@/components/SubtitleUpload";
import { useDispatch, useSelector } from "react-redux";
import { setSelectedMovie } from "@/store/movieSlice";
import { Movie } from "@/types";
import PageLayout from "@/components/ui/PageLayout";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
import { RootState } from "@/store";

const MovieSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const srtContent = useSelector((state: RootState) => state.movie.srtContent);

  const handleMovieSelect = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    navigate("/language");
  };

  const handleStartDubbing = () => {
    if (srtContent) {
      navigate("/dubbing");
    }
  };

  return (
    <PageLayout title={t("searchForMovie")}>
      <div className="h-full overflow-visible flex flex-col">
        <div className="flex-1 mb-4">
          <MovieSearch onSelectMovie={handleMovieSelect} />
        </div>
        <div className="mb-4">
          <SubtitleUpload />
        </div>
        {srtContent && (
          <Button onClick={handleStartDubbing} className="mt-4">
            {t('startDubbing')}
          </Button>
        )}
      </div>
    </PageLayout>
  );
};

export default MovieSearchPage;