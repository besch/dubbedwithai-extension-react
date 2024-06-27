import React, { useState, useEffect } from "react";
import { Movie, Subtitle } from "../types";

const Popup: React.FC = () => {
  const [movieQuery, setMovieQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [languages, setLanguages] = useState<any[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<any | null>(null);
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
      // fetchSubtitles(selectedLanguage.attributes.files[0].file_id);
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
      setLanguages(data.data || []);
    } catch (error) {
      console.error("Error getting subtitle languages:", error);
    }
  };

  // const fetchSubtitles = async (fileId: string) => {
  //   try {
  //     const response = await fetch(
  //       `http://localhost:3000/api/opensubtitles/fetch-subtitles`,
  //       {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //         },
  //         body: JSON.stringify({ fileId }),
  //       }
  //     );
  //     const data = await response.json();
  //     console.log(data.data);
  //     setSubtitles(data);
  //     chrome.storage.local.set({ subtitlesData: data });
  //   } catch (error) {
  //     console.error("Error fetching subtitles:", error);
  //   }
  // };

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
        language: selectedLanguage.attributes.language,
      });
    });
  };

  const handleSelectMovie = (movie: Movie) => {
    setSelectedMovie(movie);
    setMovies([]); // Clear the movies list
    setMovieQuery(""); // Clear the search query
  };

  return (
    <div className="p-4 w-[300px] h-[400px] bg-white rounded shadow-md">
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
              onClick={() => handleSelectMovie(movie)}
              className="cursor-pointer hover:bg-gray-100 p-1"
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 bg-white rounded-lg shadow-md p-4">
                {movie.Poster && (
                  <img
                    src={movie.Poster}
                    alt={`${movie.Title} poster`}
                    className="w-24 h-auto object-cover rounded-md shadow-sm"
                  />
                )}
                <div className="flex flex-col justify-center">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {movie.Title}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">({movie.Year})</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {selectedMovie && (
        <div className="mt-4 flex flex-col items-start">
          <h2 className="font-bold mb-2">{selectedMovie.Title}</h2>
          {selectedMovie.Poster && (
            <img
              src={selectedMovie.Poster}
              alt={`${selectedMovie.Title} poster`}
              className="w-5 h-auto object-cover rounded-md shadow-sm"
            />
          )}
          <select
            value={selectedLanguage ? selectedLanguage.attributes.language : ""}
            onChange={(e) => {
              const selectedLang = languages.find(
                (lang) => lang.attributes.language === e.target.value
              );
              setSelectedLanguage(selectedLang);
            }}
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
