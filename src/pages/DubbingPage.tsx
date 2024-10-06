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
} from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import { toast } from "react-toastify";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useTranslation } from "react-i18next";
import SocialShareButtons from "@/components/SocialShareButtons";
import { Info } from "lucide-react";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";

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
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const popperInstanceRef = useRef<PopperInstance | null>(null);

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

  useEffect(() => {
    if (activeTooltip && tooltipRef.current) {
      const targetElement = document.getElementById(activeTooltip);
      if (targetElement) {
        popperInstanceRef.current = createPopper(
          targetElement,
          tooltipRef.current,
          {
            placement: "bottom",
            modifiers: [
              {
                name: "offset",
                options: {
                  offset: [0, 8],
                },
              },
            ],
          }
        );
      }
    }

    return () => {
      if (popperInstanceRef.current) {
        popperInstanceRef.current.destroy();
        popperInstanceRef.current = null;
      }
    };
  }, [activeTooltip]);

  const handleDubbingToggle = async () => {
    if (isLoadingSubtitles) {
      toast.warning(t("waitForSubtitlesToLoad"));
      return;
    }

    try {
      await dispatch(toggleDubbingProcess());
      dispatch(updateDubbingState(!isDubbingActive));
      toast.success(
        isDubbingActive ? t("dubbingStopped") : t("dubbingStarted")
      );
    } catch (error) {
      toast.error(t("failedToToggleDubbing"));
    }
  };

  const getFullLanguageName = (languageCode: string): string =>
    languageCodes[languageCode] || languageCode;

  const handleInfoMouseEnter = (id: string) => {
    setActiveTooltip(id);
  };

  const handleInfoMouseLeave = () => {
    setActiveTooltip(null);
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
                <div
                  id="dubbing-info"
                  className="ml-2 cursor-help"
                  onMouseEnter={() => handleInfoMouseEnter("dubbing-info")}
                  onMouseLeave={handleInfoMouseLeave}
                >
                  <Info size={20} className="text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-auto pt-4">
          <SocialShareButtons />
        </div>
      </div>
      {activeTooltip && (
        <div
          ref={tooltipRef}
          className="bg-background text-foreground p-2 rounded-md text-sm z-10 border border-muted-foreground shadow-sm absolute"
        >
          {activeTooltip === "dubbing-info" && t("dubbingInfoTooltip")}
        </div>
      )}
    </PageLayout>
  );
};

export default DubbingPage;
