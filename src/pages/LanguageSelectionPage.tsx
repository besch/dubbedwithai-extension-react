import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import LanguageSelector from "@/components/LanguageSelector";
import { selectSubtitle, selectLanguages } from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const LanguageSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, isLoading, error } = useSelector(
    (state: RootState) => state.movie
  );
  const languages = useSelector(selectLanguages);

  const [seasonNumber, setSeasonNumber] = useState("1");
  const [episodeNumber, setEpisodeNumber] = useState("1");

  const handleLanguageSelect = (languageCode: string) => {
    if (selectedMovie) {
      console.log("Selecting subtitle for language:", languageCode);
      const params = {
        imdbID: selectedMovie.imdbID,
        languageCode,
        ...(selectedMovie.Type === "series" && {
          seasonNumber: parseInt(seasonNumber),
          episodeNumber: parseInt(episodeNumber),
        }),
      };
      dispatch(selectSubtitle(params))
        .unwrap()
        .then((result) => {
          if (result) {
            console.log("Subtitle selected successfully");
            navigate("/dubbing");
          } else {
            console.log("No subtitles found or an error occurred");
          }
        })
        .catch((error) => {
          console.error("Failed to select subtitle:", error);
        });
    }
  };

  if (!selectedMovie) {
    console.log("No movie selected, navigating to search");
    navigate("/search");
    return null;
  }

  return (
    <PageLayout title="Select Language">
      <div className="h-full overflow-visible">
        <div className="mb-6 animate-fade-in">
          <MovieCard movie={selectedMovie} />
        </div>

        {selectedMovie.Type === "series" && (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="seasonNumber"
                className="block mb-2 text-sm font-medium text-foreground"
              >
                Season Number
              </label>
              <input
                type="number"
                id="seasonNumber"
                value={seasonNumber}
                onChange={(e) => setSeasonNumber(e.target.value)}
                className="w-full p-2 border border-border rounded bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
              />
            </div>
            <div>
              <label
                htmlFor="episodeNumber"
                className="block mb-2 text-sm font-medium text-foreground"
              >
                Episode Number
              </label>
              <input
                type="number"
                id="episodeNumber"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                className="w-full p-2 border border-border rounded bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
              />
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-card rounded-lg shadow-sm">
          {isLoading ? (
            <div className="animate-fade-in flex flex-col items-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-red-500">{`Error: ${error}`}</div>
          ) : (
            <div className="animate-fade-in">
              <LanguageSelector
                onSelectLanguage={handleLanguageSelect}
                languages={languages}
              />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default LanguageSelectionPage;
