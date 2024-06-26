import React, { useState, useEffect } from "react";
import axios from "axios";
import { Movie, Subtitle } from "./types";

interface OpenSubtitlesResponse {
  data: {
    attributes: {
      language: string;
    };
  }[];
}

const Popup: React.FC = () => {
  const [movieQuery, setMovieQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [languages, setLanguages] = useState<any[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [dubbingAvailable, setDubbingAvailable] = useState(false);

  useEffect(() => {
    if (movieQuery.length > 2) {
      searchMovies(movieQuery);
    }
  }, [movieQuery]);

  useEffect(() => {
    if (selectedMovie) {
      getSubtitleLanguages(selectedMovie.imdbID);
    }
  }, [selectedMovie]);

  useEffect(() => {
    if (selectedMovie && selectedLanguage) {
      fetchSubtitles(selectedMovie.imdbID, selectedLanguage);
      checkDubbingAvailability(selectedMovie.imdbID, selectedLanguage);
    }
  }, [selectedMovie, selectedLanguage]);

  const searchMovies = async (text: string) => {
    try {
      const response = await fetch("http://localhost:3000/api/search-movies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      console.log(data);
      setMovies(data.Search || []);
    } catch (error) {
      console.error("Error searching movies:", error);
    }
  };

  const getSubtitleLanguages = async (imdbID: string) => {
    try {
      const response = await fetch(
        "http://localhost:3000/api/opensubtitles/get-subtitle-languages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imdbID }),
        }
      );
      const data = await response.json();
      console.log(data.data);
      setLanguages(data.data || []);
    } catch (error) {
      console.error("Error searching movies:", error);
    }
  };

  const fetchSubtitles = async (imdbID: string, language: string) => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/opensubtitles/fetch-subtitles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imdbID, language }),
        }
      );
      const data = await response.json();
      console.log(data.data);
      setSubtitles(data);
      chrome.storage.local.set({ subtitlesData: data });
    } catch (error) {
      console.error("Error fetching subtitles:", error);
    }
  };

  const checkDubbingAvailability = async (imdbID: string, language: string) => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/google-storage/check-dubbing-availability`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imdbID, language }),
        }
      );
      setDubbingAvailable(response.status === 200);
    } catch (error) {
      setDubbingAvailable(false);
    }
  };

  const handleGenerateDubbing = () => {
    // Implement dubbing generation logic here
    console.log("Generating dubbing...");
  };

  const handleApplyDubbing = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id!, {
        action: "applyDubbing",
        movieId: selectedMovie!.imdbID,
        language: selectedLanguage,
      });
    });
  };

  return (
    <div className="p-4">
      <input
        type="text"
        value={movieQuery}
        onChange={(e) => setMovieQuery(e.target.value)}
        placeholder="Search for a movie"
        className="w-full p-2 border rounded"
      />
      {movies.length > 0 && (
        <ul className="mt-2">
          {movies.map((movie) => (
            <li
              key={movie.imdbID}
              onClick={() => setSelectedMovie(movie)}
              className="cursor-pointer hover:bg-gray-100 p-1"
            >
              {movie.Title} ({movie.Year})
            </li>
          ))}
        </ul>
      )}
      {selectedMovie && (
        <div className="mt-4">
          <h2 className="font-bold">{selectedMovie.Title}</h2>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="mt-2 w-full p-2 border rounded"
          >
            <option value="">Select a language</option>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.attributes.language}>
                {lang.attributes.language} --- Rating: {lang.attributes.ratings}
                , Downloads: {lang.attributes.download_count}
              </option>
            ))}
          </select>
        </div>
      )}
      {selectedMovie && selectedLanguage && (
        <button
          onClick={handleApplyDubbing}
          className="mt-4 bg-blue-500 text-white p-2 rounded"
        >
          Apply Dubbing
        </button>
      )}
      {selectedMovie && selectedLanguage && !dubbingAvailable && (
        <button
          onClick={handleGenerateDubbing}
          className="mt-4 bg-green-500 text-white p-2 rounded"
        >
          Generate Dubbing
        </button>
      )}
    </div>
  );
};

export default Popup;
