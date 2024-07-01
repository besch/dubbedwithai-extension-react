import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  setIsGenerating,
  setIsDubbingActive,
  setDubbingAvailable,
} from "@/store/movieSlice";
import { CirclePlay, CirclePause, Loader } from "lucide-react";

const DubbingControls: React.FC = () => {
  const dispatch = useDispatch();
  const {
    selectedMovie,
    selectedLanguage,
    dubbingAvailable,
    isGenerating,
    isDubbingActive,
  } = useSelector((state: RootState) => state.movie);

  useEffect(() => {
    if (selectedMovie && selectedLanguage) {
      checkDubbingAvailability();
    } else {
      dispatch(setDubbingAvailable(false));
    }
  }, [selectedMovie, selectedLanguage]);

  const checkDubbingAvailability = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/google-storage/check-file-exists`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: `${selectedMovie!.imdbID}/${
              selectedLanguage!.attributes.subtitle_id
            }/subtitles.srt`,
          }),
        }
      );
      const data = await response.json();
      dispatch(setDubbingAvailable(data.exists));
    } catch (error) {
      console.error("Error checking dubbing availability:", error);
      dispatch(setDubbingAvailable(false));
    }
  };

  const handleGenerateDubbing = async () => {
    dispatch(setIsGenerating(true));
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/generate-dub`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imdbID: selectedMovie!.imdbID,
            subtitleID: selectedLanguage!.attributes.subtitle_id,
            fileId: selectedLanguage!.attributes.files[0].file_id,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        dispatch(setDubbingAvailable(true));
      } else {
        throw new Error("Failed to generate dubbing");
      }
    } catch (error) {
      console.error("Error generating dubbing:", error);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Dubbing Generation Failed",
        message: "There was an error generating the dubbing. Please try again.",
      });
    } finally {
      dispatch(setIsGenerating(false));
    }
  };

  const handleApplyDubbing = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "applyDubbing",
            movieId: selectedMovie!.imdbID,
            subtitleId: selectedLanguage!.attributes.subtitle_id,
          },
          () => {
            dispatch(setIsDubbingActive(true));
          }
        );
      }
    });
  };

  const handleStopDubbing = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "stopDubbing" }, () => {
          dispatch(setIsDubbingActive(false));
        });
      }
    });
  };

  if (!selectedMovie || !selectedLanguage) {
    return null;
  }

  return (
    <div className="mt-4">
      {dubbingAvailable ? (
        <div>
          {isDubbingActive ? (
            <button
              onClick={handleStopDubbing}
              className="bg-red-500 text-white p-2 rounded w-full flex items-center justify-center"
            >
              <CirclePause className="mr-2" size={20} />
              Stop Dubbing
            </button>
          ) : (
            <button
              onClick={handleApplyDubbing}
              className="bg-blue-500 text-white p-2 rounded w-full flex items-center justify-center"
            >
              <CirclePlay className="mr-2" size={20} />
              Apply Existing Dubbing
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleGenerateDubbing}
          disabled={isGenerating}
          className={`mt-4 ${
            isGenerating ? "bg-gray-500" : "bg-green-500"
          } text-white p-2 rounded w-full flex items-center justify-center`}
        >
          {isGenerating ? (
            <>
              <Loader className="mr-2 animate-spin" size={20} />
              Generating Dubbing...
            </>
          ) : (
            <>
              <CirclePlay className="mr-2" size={20} />
              Generate Dubbing
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default DubbingControls;
