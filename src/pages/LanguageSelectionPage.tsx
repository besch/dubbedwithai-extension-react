import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import LanguageSelector from "@/components/LanguageSelector";
import {
  selectSubtitle,
  selectLanguages,
  setLastSelectedLanguage,
  loadLastSelectedLanguage,
  setSelectedSeasonNumber,
  setSelectedEpisodeNumber,
} from "@/store/movieSlice";
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
  const lastSelectedLanguage = useSelector(
    (state: RootState) => state.movie.lastSelectedLanguage
  );

  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(null);

  useEffect(() => {
    dispatch(loadLastSelectedLanguage());
  }, [dispatch]);

  const handleLanguageSelect = (languageCode: string) => {
    if (selectedMovie) {
      console.log("Selecting subtitle for language:", languageCode);
      const params: any = {
        imdbID: selectedMovie.imdbID,
        languageCode,
      };

      if (selectedMovie.Type === "series" && seasonNumber && episodeNumber) {
        params.seasonNumber = seasonNumber;
        params.episodeNumber = episodeNumber;
        dispatch(setSelectedSeasonNumber(seasonNumber));
        dispatch(setSelectedEpisodeNumber(episodeNumber));
      }

      dispatch(selectSubtitle(params))
        .unwrap()
        .then((result) => {
          if (result) {
            console.log("Subtitle selected successfully");
            const selectedLanguage = languages.find(
              (lang) => lang.id === languageCode
            );
            if (selectedLanguage) {
              dispatch(setLastSelectedLanguage(selectedLanguage));
            }
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

  const handleUseLastLanguage = () => {
    if (lastSelectedLanguage && selectedMovie) {
      handleLanguageSelect(lastSelectedLanguage.id);
    }
  };

  if (!selectedMovie) {
    console.log("No movie selected, navigating to search");
    navigate("/search");
    return null;
  }

  const isSeriesWithoutEpisodeInfo =
    selectedMovie.Type === "series" &&
    (seasonNumber === null || episodeNumber === null);

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
                value={seasonNumber || ""}
                onChange={(e) => setSeasonNumber(Number(e.target.value))}
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
                value={episodeNumber || ""}
                onChange={(e) => setEpisodeNumber(Number(e.target.value))}
                className="w-full p-2 border border-border rounded bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
              />
            </div>
          </div>
        )}

        {!isSeriesWithoutEpisodeInfo && (
          <div className="mt-6 p-4 bg-card rounded-lg shadow-sm">
            {isLoading ? (
              <div className="animate-fade-in flex flex-col items-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="text-red-500">{`Error: ${error}`}</div>
            ) : (
              <div className="animate-fade-in">
                {lastSelectedLanguage && (
                  <div className="mb-8 bg-accent bg-opacity-10 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Last selected language:{" "}
                      <span className="font-semibold">
                        {lastSelectedLanguage.attributes.language_name}
                      </span>
                    </p>
                    <button
                      onClick={handleUseLastLanguage}
                      className="mt-2 px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                    >
                      Use {lastSelectedLanguage.attributes.language_name}
                    </button>
                  </div>
                )}
                <LanguageSelector
                  onSelectLanguage={handleLanguageSelect}
                  languages={languages}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default LanguageSelectionPage;
