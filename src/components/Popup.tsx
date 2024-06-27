import React, { useState, useEffect } from "react";
import { Movie, Subtitle } from "@/types";
import MovieSearch from "./MovieSearch";
import LanguageSelector from "./LanguageSelector";

const Popup: React.FC = () => {
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [languages, setLanguages] = useState<any[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<any | null>(null);
  const [dubbingAvailable, setDubbingAvailable] = useState(false);

  useEffect(() => {
    if (selectedMovie) {
      getSubtitleLanguages(selectedMovie.imdbID);
    }
  }, [selectedMovie]);

  useEffect(() => {
    if (selectedMovie && selectedLanguage) {
      checkDubbingAvailability(
        selectedMovie.imdbID,
        selectedLanguage.attributes.language
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
        "http://localhost:3000/api/opensubtitles/get-subtitle-languages",
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

  const checkDubbingAvailability = async (imdbID: string, language: string) => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/google-storage/check-dubbing-availability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imdbID, language }),
        }
      );
      setDubbingAvailable(response.status === 200);
    } catch (error) {
      setDubbingAvailable(false);
    }
  };

  const handleGenerateDubbing = () => {
    console.log("Generating dubbing...");
  };

  const handleApplyDubbing = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "applyDubbing",
            movieId: selectedMovie!.imdbID,
            language: selectedLanguage.attributes.language,
          },
          () => {
            // Close the popup after sending the message
            window.close();
          }
        );
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
      {selectedMovie && selectedLanguage && (
        <button
          onClick={handleApplyDubbing}
          className="mt-4 bg-blue-500 text-white p-2 rounded w-full"
        >
          Apply Dubbing
        </button>
      )}
      {selectedMovie && selectedLanguage && !dubbingAvailable && (
        <button
          onClick={handleGenerateDubbing}
          className="mt-4 bg-green-500 text-white p-2 rounded w-full"
        >
          Generate Dubbing
        </button>
      )}
    </div>
  );
};

export default Popup;
