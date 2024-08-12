import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import {
  updateDubbingState,
  checkDubbingStatus,
  loadSubtitles,
  startDubbingProcess,
} from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import { sendMessageToActiveTab } from "@/lib/messaging";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import { toast } from "react-toastify";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const DubbingPage: React.FC = () => {
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
          toast.error("Failed to load subtitles. Please try again.");
          setIsLoadingSubtitles(false);
        });
    }
  }, [selectedMovie, selectedLanguage, subtitlesLoaded, dispatch, navigate]);

  const handleDubbingToggle = async (isActive: boolean) => {
    if (isLoadingSubtitles) {
      toast.warning(
        "Please wait for subtitles to load before toggling dubbing."
      );
      return;
    }

    if (!subtitlesLoaded) {
      toast.error("Subtitles are not loaded. Please try reloading the page.");
      return;
    }

    try {
      if (isActive) {
        await dispatch(startDubbingProcess()).unwrap();
        toast.success("Dubbing started successfully");
      } else {
        const response = await sendMessageToActiveTab({
          action: "updateDubbingState",
          payload: false,
        });

        if (response?.status === "updated") {
          dispatch(updateDubbingState(false));
          toast.success("Dubbing paused successfully");
        } else {
          return console.error("Failed to pause dubbing");
        }
      }
    } catch (error) {
      console.error("Failed to toggle dubbing:", error);
      toast.error("Failed to toggle dubbing. Please try again.");
      dispatch(updateDubbingState(false));
    }
  };

  const getFullLanguageName = (languageCode: string): string =>
    languageCodes[languageCode] || languageCode;

  if (!selectedMovie || !selectedLanguage) {
    return (
      <PageLayout title="Dubbing Controls">
        {toast.error("No movie or language selected")}
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Dubbing Controls">
      <div className="space-y-4">
        <MovieCard movie={selectedMovie} />
        <p className="text-sm text-muted-foreground">
          Language: {getFullLanguageName(selectedLanguage.attributes.language)}
        </p>
        {selectedMovie.Type === "series" &&
          selectedSeasonNumber &&
          selectedEpisodeNumber && (
            <p className="text-sm text-muted-foreground">
              Season: {selectedSeasonNumber}, Episode: {selectedEpisodeNumber}
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
