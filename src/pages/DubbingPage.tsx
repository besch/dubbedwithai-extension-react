import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import {
  updateDubbingState,
  checkDubbingStatus,
  loadSubtitles,
  toggleDubbingProcess
} from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import { toast } from "react-toastify";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useTranslation } from "react-i18next";

const DubbingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const {
    selectedMovie,
    selectedLanguage,
    isDubbingActive,
    subtitlesLoaded,
    selectedSeasonNumber,
    selectedEpisodeNumber,
  } = useSelector((state: RootState) => state.movie);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);

  useEffect(() => {
    if (!selectedMovie || !selectedLanguage) {
      navigate("/search");
      return;
    }

    dispatch(checkDubbingStatus());
    if (!subtitlesLoaded) {
      setIsLoadingSubtitles(true);
      dispatch(loadSubtitles())
        .unwrap()
        .then(() => {
          setIsLoadingSubtitles(false);
        })
        .catch((error) => {
          console.error("Failed to load subtitles:", error);
          toast.error(t("failedToLoadSubtitles"));
          setIsLoadingSubtitles(false);
        });
    }
  }, [selectedMovie, selectedLanguage, subtitlesLoaded, dispatch, navigate, t]);

  const handleDubbingToggle = async () => {
    if (isLoadingSubtitles) {
      toast.warning(t("waitForSubtitlesToLoad"));
      return;
    }

    if (!subtitlesLoaded) {
      toast.error(t("subtitlesNotLoaded"));
      return;
    }

    try {
      await dispatch(toggleDubbingProcess());
      dispatch(updateDubbingState(!isDubbingActive));
      toast.success(isDubbingActive ? t("dubbingStopped") : t("dubbingStarted"));
    } catch (error) {
      console.error("Failed to toggle dubbing:", error);
      toast.error(t("failedToToggleDubbing"));
    }
  };

  const getFullLanguageName = (languageCode: string): string =>
    languageCodes[languageCode] || languageCode;

  if (!selectedMovie || !selectedLanguage) {
    return (
      <PageLayout title={t("dubbingControls")}>
        {toast.error(t("noMovieOrLanguageSelected"))}
      </PageLayout>
    );
  }

  return (
    <PageLayout title={t("dubbingControls")}>
      <div className="space-y-4">
        <MovieCard movie={selectedMovie} />
        <p className="text-sm text-muted-foreground">
          {t("language")}:{" "}
          {getFullLanguageName(selectedLanguage.attributes.language)}
        </p>
        {selectedMovie.Type === "series" &&
          selectedSeasonNumber &&
          selectedEpisodeNumber && (
            <p className="text-sm text-muted-foreground">
              {t("seasonEpisode", {
                season: selectedSeasonNumber,
                episode: selectedEpisodeNumber,
              })}
            </p>
          )}
        {isLoadingSubtitles ? (
          <LoadingSpinner size="lg" />
        ) : (
          <DubbingControls
            isDubbingActive={isDubbingActive}
            onDubbingToggle={handleDubbingToggle}
            disabled={isLoadingSubtitles}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default DubbingPage;
