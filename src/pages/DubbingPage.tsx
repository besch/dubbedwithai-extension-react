import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import { setIsDubbingActive, checkDubbingStatus } from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import { sendMessageToActiveTab } from "@/lib/messaging";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import { Alert, AlertDescription } from "@/components/ui/Alert";

const DubbingPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, selectedLanguage, isDubbingActive } = useSelector(
    (state: RootState) => state.movie
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMovie && selectedLanguage) {
      dispatch(checkDubbingStatus());
    }
  }, [selectedMovie, selectedLanguage, dispatch]);

  const handleDubbingToggle = async (isActive: boolean) => {
    setError(null);
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
    } catch (error) {
      console.error("Failed to toggle dubbing:", error);
      setError(
        "Failed to toggle dubbing or video player not found. Please try again."
      );
      dispatch(setIsDubbingActive(false));
    }
  };

  const getFullLanguageName = (languageCode: string): string =>
    languageCodes[languageCode] || languageCode;

  if (!selectedMovie || !selectedLanguage) {
    return (
      <PageLayout title="Dubbing Controls">
        <Alert variant="destructive">
          <AlertDescription>No movie or language selected</AlertDescription>
        </Alert>
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
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DubbingControls
          isDubbingActive={isDubbingActive}
          onDubbingToggle={handleDubbingToggle}
        />
      </div>
    </PageLayout>
  );
};

export default DubbingPage;
