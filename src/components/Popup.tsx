import React, { useState, useEffect } from "react";
import { Movie, Subtitle } from "@/types";
import MovieSearch from "./MovieSearch";
import LanguageSelector from "./LanguageSelector";

const Popup: React.FC = () => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [languages, setLanguages] = useState<any[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<any | null>(null);
  const [dubbingAvailable, setDubbingAvailable] = useState(false);
  const [dubbingPath, setDubbingPath] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDubbingActive, setIsDubbingActive] = useState(false);

  useEffect(() => {
    if (selectedMovie) {
      getSubtitleLanguages(selectedMovie.imdbID);
    }
  }, [selectedMovie]);

  useEffect(() => {
    if (selectedMovie && selectedLanguage) {
      checkDubbingAvailability(
        selectedMovie.imdbID,
        selectedLanguage.attributes.subtitle_id
      );
    }
  }, [selectedMovie, selectedLanguage]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id!, allFrames: true },
          files: ["content.js"],
        });
      }
    });
  }, []);

  const getSubtitleLanguages = async (imdbID: string) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/opensubtitles/get-subtitle-languages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imdbID }),
        }
      );
      const data = await response.json();
      setLanguages(data.data || []);
    } catch (error) {
      console.error("Error getting subtitle languages:", error);
    }
  };

  const checkDubbingAvailability = async (
    imdbID: string,
    subtitleId: string
  ) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/google-storage/check-file-exists`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: `${imdbID}/${subtitleId}/subtitles.srt`,
          }),
        }
      );
      const data = await response.json();
      setDubbingAvailable(data.exists);
      setDubbingPath(data.dubbingPath || null);
    } catch (error) {
      setDubbingAvailable(false);
      setDubbingPath(null);
    }
  };

  const handleGenerateDubbing = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/generate-dub`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imdbID: selectedMovie!.imdbID,
            subtitleID: selectedLanguage.attributes.subtitle_id,
            fileId: selectedLanguage.attributes.files[0].file_id,
          }),
        }
      );

      if (response.ok) {
        await checkDubbingAvailability(
          selectedMovie!.imdbID,
          selectedLanguage.attributes.subtitle_id
        );
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
      setIsGenerating(false);
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
            subtitleId: selectedLanguage.attributes.subtitle_id,
          },
          () => {
            setIsDubbingActive(true);
          }
        );
      }
    });
  };

  const handleStopDubbing = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "stopDubbing" }, () => {
          setIsDubbingActive(false);
        });
      }
    });
  };

  return (
    <div className="p-4 w-[300px] h-[400px] bg-white rounded shadow-md">
      <MovieSearch
        onSelectMovie={setSelectedMovie}
        selectedMovie={selectedMovie}
      />
      {selectedMovie && (
        <div className="mt-4 flex flex-col items-start">
          <h2 className="font-bold mb-2">{selectedMovie.Title}</h2>
          {selectedMovie.Poster && selectedMovie.Poster !== "N/A" ? (
            <img
              src={selectedMovie.Poster}
              alt={`${selectedMovie.Title} poster`}
              className="w-24 h-36 object-cover rounded-md shadow-sm mb-2"
            />
          ) : (
            <div className="w-24 h-36 bg-gray-200 flex items-center justify-center rounded-md shadow-sm mb-2">
              <span className="text-gray-500 text-xs text-center">
                No poster available
              </span>
            </div>
          )}
          <LanguageSelector
            languages={languages}
            selectedLanguage={selectedLanguage}
            onSelectLanguage={setSelectedLanguage}
          />
        </div>
      )}
      {selectedMovie && selectedLanguage && dubbingAvailable && (
        <div className="mt-4">
          <p className="text-sm mb-2">Dubbing path: {dubbingPath}</p>
          {isDubbingActive ? (
            <button
              onClick={handleStopDubbing}
              className="bg-red-500 text-white p-2 rounded w-full"
            >
              Stop Dubbing
            </button>
          ) : (
            <button
              onClick={handleApplyDubbing}
              className="bg-blue-500 text-white p-2 rounded w-full"
            >
              Apply Existing Dubbing
            </button>
          )}
        </div>
      )}
      {selectedMovie && selectedLanguage && !dubbingAvailable && (
        <button
          onClick={handleGenerateDubbing}
          disabled={isGenerating}
          className={`mt-4 ${
            isGenerating ? "bg-gray-500" : "bg-green-500"
          } text-white p-2 rounded w-full`}
        >
          {isGenerating ? "Generating Dubbing..." : "Generate Dubbing"}
        </button>
      )}
    </div>
  );
};

export default Popup;
