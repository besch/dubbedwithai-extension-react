import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import CurrentSubtitle from "@/components/CurrentSubtitle";
import { setIsDubbingActive, startDubbingProcess } from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";
import { sendMessageToActiveTab } from "@/lib/messaging";

const DubbingPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, selectedLanguage, isDubbingActive } = useSelector(
    (state: RootState) => state.movie
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMovie && selectedLanguage) {
      sendMessageToActiveTab({ action: "checkDubbingStatus" })
        .then((response: any) => {
          if (response.status === "checked") {
            dispatch(setIsDubbingActive(response.isDubbingActive));
          } else {
            throw new Error("Unexpected response from content script");
          }
        })
        .catch((error) => {
          console.error("Failed to check dubbing status:", error);
          setError(
            "Failed to communicate with the active tab. Please refresh the page and try again."
          );
          dispatch(setIsDubbingActive(false));
        });
    }
  }, [dispatch, selectedMovie, selectedLanguage]);

  const handleDubbingToggle = async (isActive: boolean) => {
    setError(null);
    try {
      if (isActive) {
        const response = await sendMessageToActiveTab({
          action: "initializeDubbing",
          movieId: selectedMovie?.imdbID,
          subtitleId: selectedLanguage?.id,
        });
        if (response.status !== "initialized") {
          throw new Error("Failed to initialize dubbing");
        }
      } else {
        const response = await sendMessageToActiveTab({
          action: "stopDubbing",
        });
        if (response.status !== "stopped") {
          throw new Error("Failed to stop dubbing");
        }
      }
      dispatch(setIsDubbingActive(isActive));
    } catch (error) {
      console.error("Failed to toggle dubbing:", error);
      setError("Failed to toggle dubbing. Please try again.");
    }
  };

  const getFullLanguageName = (languageCode: string): string => {
    return languageCodes[languageCode] || languageCode;
  };

  if (!selectedMovie || !selectedLanguage) {
    return <div className="p-4">No movie or language selected</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Dubbing Controls</h2>
      <div className="mb-4 flex items-start">
        {selectedMovie.Poster && selectedMovie.Poster !== "N/A" ? (
          <img
            src={selectedMovie.Poster}
            alt={`${selectedMovie.Title} poster`}
            className="w-24 h-36 object-cover rounded-md shadow-sm mr-4"
          />
        ) : (
          <div className="w-24 h-36 bg-gray-200 flex items-center justify-center rounded-md shadow-sm mr-4">
            <span className="text-gray-500 text-xs text-center">No poster</span>
          </div>
        )}
        <div>
          <h3 className="font-semibold">{selectedMovie.Title}</h3>
          <p className="text-sm text-gray-600">{selectedMovie.Year}</p>
          <p className="text-sm text-gray-600">
            Language:{" "}
            {getFullLanguageName(selectedLanguage.attributes.language)}
          </p>
        </div>
      </div>
      {error && <div className="text-red-500 mt-2">{error}</div>}
      <DubbingControls
        isDubbingActive={isDubbingActive}
        onDubbingToggle={handleDubbingToggle}
      />
      <CurrentSubtitle />
    </div>
  );
};

export default DubbingPage;
