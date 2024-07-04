// src/pages/DubbingPage.tsx
import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import CurrentSubtitle from "@/components/CurrentSubtitle";
import { setIsDubbingActive, startDubbingProcess } from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes";

const DubbingPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, selectedLanguage, isDubbingActive } = useSelector(
    (state: RootState) => state.movie
  );

  useEffect(() => {
    console.log("dispatch, isDubbingActive, selectedMovie, selectedLanguage");
    if (isDubbingActive && selectedMovie && selectedLanguage) {
      // Start the dubbing process when the component mounts if dubbing is active
      dispatch(startDubbingProcess());

      // Send message to content script to check dubbing status
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "checkDubbingStatus" });
        }
      });
    }
  }, [dispatch, isDubbingActive, selectedMovie, selectedLanguage]);

  const handleDubbingToggle = async (isActive: boolean) => {
    await dispatch(setIsDubbingActive(isActive));
    if (isActive) {
      dispatch(startDubbingProcess());
    } else {
      // Send message to content script to stop dubbing
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "stopDubbing" });
        }
      });
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
      <DubbingControls
        isDubbingActive={isDubbingActive}
        onDubbingToggle={handleDubbingToggle}
      />
      <CurrentSubtitle />
    </div>
  );
};

export default DubbingPage;
