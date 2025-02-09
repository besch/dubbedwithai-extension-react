import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import {
  checkDubbingStatus,
  loadSubtitles,
  toggleDubbingProcess,
} from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import { Star, ArrowRight } from "lucide-react";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import { toast } from "react-toastify";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useTranslation } from "react-i18next";
import SocialShareButtons from "@/components/SocialShareButtons";
import InfoTooltip from "@/components/ui/InfoTooltip";

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
      await dispatch(toggleDubbingProcess()).unwrap();
      toast.success(
        isDubbingActive ? t("dubbingStopped") : t("dubbingStarted")
      );
    } catch (error) {
      toast.error(t("failedToToggleDubbing"));
    }
  };

  const getFullLanguageName = (languageCode: string): string =>
    languageCodes[languageCode] || languageCode;

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
          <div className="mb-4 bg-muted py-[14px] px-4 rounded-lg shadow">
            <div className="flex items-center">
              <Star className="h-6 w-6 text-yellow-500" />
              <span className="ml-2 text-lg font-semibold text-foreground">
                {t("rateOurExtension", "Rate OneDub")}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "pleaseRateOurExtension",
                "If you enjoy using our extension, please leave a rating on the Chrome Web Store!"
              )}
            </p>
            <a
              href="https://chromewebstore.google.com/detail/onedub/cphceeehafncfeigajlnajkbddokpn"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium px-4 py-2 rounded"
            >
              {t("rateNow", "Rate Now")}
              <ArrowRight className="ml-2 h-5 w-5 text-primary-foreground" />
            </a>
          </div>
          <SocialShareButtons />
        </div>
      </div>
    </PageLayout>
  );
};

export default DubbingPage;
