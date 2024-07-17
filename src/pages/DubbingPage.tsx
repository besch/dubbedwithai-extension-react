import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import { setIsDubbingActive, checkDubbingStatus } from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import { sendMessageToActiveTab } from "@/lib/messaging";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import { toast } from "react-toastify";

const DubbingPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, selectedLanguage, isDubbingActive } = useSelector(
    (state: RootState) => state.movie
  );

  useEffect(() => {
    if (selectedMovie && selectedLanguage) {
      dispatch(checkDubbingStatus());
    }
  }, [selectedMovie, selectedLanguage, dispatch]);

  const handleDubbingToggle = async (isActive: boolean) => {
    try {
      const action = isActive ? "initializeDubbing" : "stopDubbing";
      const message = isActive
        ? {
            action,
            movieId: selectedMovie?.imdbID,
            subtitleId: selectedLanguage?.id,
          }
        : { action };

      const response = await sendMessageToActiveTab(message);

      if (response?.status === "error") {
        throw new Error(response.message);
      } else if (
        (isActive && response?.status !== "initialized") ||
        (!isActive && response?.status !== "stopped")
      ) {
        throw new Error(
          `Failed to ${isActive ? "initialize" : "stop"} dubbing`
        );
      }

      dispatch(setIsDubbingActive(isActive));
      toast.success(`Dubbing ${isActive ? "started" : "stopped"} successfully`);
    } catch (error) {
      console.error("Failed to toggle dubbing:", error);
      toast.error(
        "Failed to toggle dubbing. Or video player not found. Please try again."
      );
      dispatch(setIsDubbingActive(false));
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
        <DubbingControls
          isDubbingActive={isDubbingActive}
          onDubbingToggle={handleDubbingToggle}
        />
      </div>
    </PageLayout>
  );
};

export default DubbingPage;
