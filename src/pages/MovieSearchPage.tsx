import React from "react";
import { useNavigate } from "react-router-dom";
import MovieSearch from "@/components/MovieSearch";
import SubtitleUpload from "@/components/SubtitleUpload";
import { useDispatch } from "react-redux";
import { setSelectedMovie, setSearchResults } from "@/store/movieSlice";
import { Movie } from "@/types";
import PageLayout from "@/components/ui/PageLayout";
import { useTranslation } from "react-i18next";

const MovieSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const handleMovieSelect = (movie: Movie) => {
    dispatch(setSelectedMovie(movie));
    navigate("/language");
  };

  React.useEffect(() => {
    dispatch(setSearchResults([]));
  }, [dispatch]);

  return (
    <PageLayout title={t("subtitles")}>
      <div className="h-full overflow-visible flex flex-col space-y-3">
        <div className="bg-card hover:bg-accent transition-colors duration-200 p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">{t("searchForMovie")}</h2>
          <MovieSearch onSelectMovie={handleMovieSelect} />
        </div>
        <div className="bg-card hover:bg-accent transition-colors duration-200 p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">{t("uploadSubtitles")}</h2>
          <SubtitleUpload />
        </div>
      </div>
    </PageLayout>
  );
};

export default MovieSearchPage;
