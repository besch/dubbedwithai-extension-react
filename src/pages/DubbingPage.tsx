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
      if (isActive) {
        // Check if dubbing is already initialized
        const response = await sendMessageToActiveTab({
          action: "checkDubbingStatus",
        });

        if (response?.isDubbingActive) {
          // If dubbing is already initialized, just update the state
          dispatch(setIsDubbingActive(true));
          toast.success("Dubbing resumed successfully");
        } else {
          // If dubbing is not initialized, initialize it
          const initResponse = await sendMessageToActiveTab({
            action: "initializeDubbing",
            movieId: selectedMovie?.imdbID,
            subtitleId: selectedLanguage?.id,
          });

          if (initResponse?.status === "initialized") {
            dispatch(setIsDubbingActive(true));
            toast.success("Dubbing started successfully");
          } else {
            throw new Error("Failed to initialize dubbing");
          }
        }
      } else {
        // When stopping, we'll use updateDubbingState to pause the audio and timer
        const response = await sendMessageToActiveTab({
          action: "updateDubbingState",
          payload: false,
        });

        if (response?.status === "updated") {
          dispatch(setIsDubbingActive(false));
          toast.success("Dubbing paused successfully");
        } else {
          throw new Error("Failed to pause dubbing");
        }
      }
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
