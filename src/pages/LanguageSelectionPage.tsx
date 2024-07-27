import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import LanguageSelector from "@/components/LanguageSelector";
import { selectSubtitle, selectLanguages } from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";

const LanguageSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, isLoading, error } = useSelector(
    (state: RootState) => state.movie
  );
  const languages = useSelector(selectLanguages);

  const handleLanguageSelect = (languageCode: string) => {
    if (selectedMovie) {
      console.log("Selecting subtitle for language:", languageCode);
      dispatch(selectSubtitle({ imdbID: selectedMovie.imdbID, languageCode }))
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

        <div className="mt-6 p-4 bg-card rounded-lg shadow-sm">
          {isLoading ? (
            <div className="animate-fade-in flex flex-col items-center">
              <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
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
