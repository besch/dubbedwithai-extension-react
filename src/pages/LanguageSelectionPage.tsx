import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useTranslation } from "react-i18next";
import { RootState, AppDispatch } from "@/store";
import LanguageSelector from "@/components/LanguageSelector";
import {
  selectSubtitle,
  availableLanguages,
  setLastSelectedLanguage,
  loadLastSelectedLanguage,
  setSelectedSeasonNumber,
  setSelectedEpisodeNumber,
  setSelectedLanguage,
  resetLoadingState,
} from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Button from "@/components/ui/Button";

const LanguageSelectionPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, isLoading } = useSelector(
    (state: RootState) => state.movie
  );
  const languages = useSelector(availableLanguages);
  const lastSelectedLanguage = useSelector(
    (state: RootState) => state.movie.lastSelectedLanguage
  );

  const [seasonNumber, setSeasonNumber] = useState<number | null>(null);
  const [episodeNumber, setEpisodeNumber] = useState<number | null>(null);

  useEffect(() => {
    dispatch(loadLastSelectedLanguage());
  }, [dispatch]);

  const handleLanguageSelect = async (languageCode: string) => {
    if (selectedMovie) {
      const url = await new Promise<string>((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          resolve(tabs[0]?.url || "");
        });
      });

      const params: any = {
        imdbID: selectedMovie.imdbID,
        languageCode,
        url,
      };

      if (selectedMovie.Type === "series" && seasonNumber && episodeNumber) {
        params.seasonNumber = seasonNumber;
        params.episodeNumber = episodeNumber;
        dispatch(setSelectedSeasonNumber(seasonNumber));
        dispatch(setSelectedEpisodeNumber(episodeNumber));
      }

      const selectedLanguage = languages.find(
        (lang) => lang.id === languageCode
      );

      if (selectedLanguage) {
        dispatch(setSelectedLanguage(selectedLanguage));
        dispatch(setLastSelectedLanguage(selectedLanguage));
      }

      dispatch(selectSubtitle(params))
        .unwrap()
        .then((result) => {
          if (result) {
            navigate("/dubbing");
          }
        });
    }
  };

  const handleUseLastLanguage = () => {
    if (lastSelectedLanguage && selectedMovie) {
      dispatch(setSelectedLanguage(lastSelectedLanguage));
      handleLanguageSelect(lastSelectedLanguage.id);
    }
  };

  const handleCancelFetch = () => {
    dispatch(resetLoadingState());
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
    <PageLayout title={t("selectLanguage")}>
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
                {t("seasonNumber")}
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
                {t("episodeNumber")}
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
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  {t("subtitlesGenerate")}
                </p>
                <Button
                  onClick={handleCancelFetch}
                  variant="outline"
                  className="mt-4"
                >
                  {t("cancel")}
                </Button>
              </div>
            ) : (
              <div className="animate-fade-in">
                {lastSelectedLanguage && (
                  <div className="mb-8 bg-accent bg-opacity-10 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {t("lastSelectedLanguage")}{" "}
                      <span className="font-semibold">
                        {lastSelectedLanguage.attributes.language_name}
                      </span>
                    </p>
                    <Button
                      onClick={handleUseLastLanguage}
                      className="mt-2 w-full"
                      variant="secondary"
                    >
                      {t("useLanguage", {
                        language: lastSelectedLanguage.attributes.language_name,
                      })}
                    </Button>
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
