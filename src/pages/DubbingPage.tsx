import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import {
  updateDubbingState,
  checkDubbingStatus,
  loadSubtitles,
  toggleDubbingProcess,
  startManualAlignment,
  cancelManualAlignment,
} from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import { toast } from "react-toastify";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useTranslation } from "react-i18next";
import SocialShareButtons from "@/components/SocialShareButtons";
import InfoTooltip from "@/components/ui/InfoTooltip";
import Button from "@/components/ui/Button";

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
    srtContent,
  } = useSelector((state: RootState) => state.movie);
  const [isLoadingSubtitles, setIsLoadingSubtitles] = useState(false);
  const [isAligning, setIsAligning] = useState(false);

  useEffect(() => {
    if (!srtContent) {
      navigate("/search");
      return;
    }

    const checkStatus = () => dispatch(checkDubbingStatus());

    checkStatus();

    if (!subtitlesLoaded) {
      setIsLoadingSubtitles(true);
      dispatch(loadSubtitles())
        .unwrap()
        .then(() => {
          setIsLoadingSubtitles(false);
        })
        .catch((error) => {
          toast.error(t("failedToLoadSubtitles"));
          setIsLoadingSubtitles(false);
        });
    }
  }, [
    selectedMovie,
    selectedLanguage,
    subtitlesLoaded,
    dispatch,
    navigate,
    t,
    srtContent,
  ]);

  const handleDubbingToggle = async () => {
    if (isLoadingSubtitles) {
      toast.warning(t("waitForSubtitlesToLoad"));
      return;
    }

    try {
      await dispatch(toggleDubbingProcess());
      toast.success(
        isDubbingActive ? t("dubbingStopped") : t("dubbingStarted")
      );
    } catch (error) {
      toast.error(t("failedToToggleDubbing"));
    }
  };

  const getFullLanguageName = (languageCode: string): string =>
    languageCodes[languageCode] || languageCode;

  const handleManualAlignment = async () => {
    setIsAligning(true);
    try {
      await dispatch(startManualAlignment());
      toast.success(t("alignmentComplete"));
    } catch (error: any) {
      if (error.message !== "Alignment cancelled") {
        toast.error(t("alignmentFailed"));
      }
    } finally {
      setIsAligning(false);
    }
  };

  const handleCancelAlignment = async () => {
    try {
      await dispatch(cancelManualAlignment());
      toast.info(t("alignmentCancelled"));
    } catch (error) {
      toast.error(t("failedToCancelAlignment"));
    }
  };

  return (
    <PageLayout title={t("dubbingControls")}>
      <div className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto">
          <div className="space-y-4">
            {selectedMovie && <MovieCard movie={selectedMovie} />}
            {selectedLanguage && (
              <p className="text-sm text-muted-foreground">
                {t("language")}:{" "}
                {getFullLanguageName(selectedLanguage.attributes.language)}
              </p>
            )}
            {selectedMovie?.Type === "series" &&
              selectedSeasonNumber &&
              selectedEpisodeNumber && (
                <p className="text-sm text-muted-foreground">
                  {t("seasonEpisode", {
                    season: selectedSeasonNumber,
                    episode: selectedEpisodeNumber,
                  })}
                </p>
              )}
            {srtContent && !selectedMovie && !selectedLanguage && (
              <p className="text-sm text-muted-foreground">
                {t("usingUploadedSubtitles")}
              </p>
            )}
            {isLoadingSubtitles ? (
              <LoadingSpinner size="lg" />
            ) : (
              <div className="relative inline-flex items-center">
                <DubbingControls
                  isDubbingActive={isDubbingActive}
                  onDubbingToggle={handleDubbingToggle}
                  disabled={isLoadingSubtitles}
                />
                <Button
                  onClick={
                    isAligning ? handleCancelAlignment : handleManualAlignment
                  }
                  // disabled={!isDubbingActive}
                  className="ml-2"
                >
                  {isAligning ? t("cancelAlignment") : t("alignSubtitles")}
                </Button>
                <div className="ml-2">
                  <InfoTooltip
                    id="dubbing-info"
                    content={t("dubbingInfoTooltip")}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-auto pt-4">
          <SocialShareButtons />
        </div>
      </div>
    </PageLayout>
  );
};

export default DubbingPage;
