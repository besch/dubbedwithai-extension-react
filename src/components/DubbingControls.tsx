import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

interface DubbingControlsProps {
  isDubbingActive: boolean;
  onDubbingToggle: (isActive: boolean) => void;
}

const DubbingControls: React.FC<DubbingControlsProps> = ({
  isDubbingActive,
  onDubbingToggle,
}) => {
  const { selectedMovie, selectedLanguage } = useSelector(
    (state: RootState) => state.movie
  );

  const handleToggleDubbing = () => {
    const newDubbingState = !isDubbingActive;
    onDubbingToggle(newDubbingState);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab.id) {
        if (newDubbingState) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: "applyDubbing",
            movieId: selectedMovie?.imdbID,
            subtitleId: selectedLanguage?.id,
          });
        } else {
          chrome.tabs.sendMessage(activeTab.id, { action: "stopDubbing" });
        }
      }
    });
  };

  if (!selectedMovie || !selectedLanguage) {
    return null;
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleToggleDubbing}
        className={`w-full p-2 rounded ${
          isDubbingActive
            ? "bg-red-500 hover:bg-red-600"
            : "bg-blue-500 hover:bg-blue-600"
        } text-white`}
      >
        {isDubbingActive ? "Stop Dubbing" : "Apply Existing Dubbing"}
      </button>
    </div>
  );
};

export default DubbingControls;
