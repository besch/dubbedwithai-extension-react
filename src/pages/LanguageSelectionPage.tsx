import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import LanguageSelector from "@/components/LanguageSelector";
import { setSelectedLanguage, fetchLanguages } from "@/store/movieSlice";
import { Language } from "@/types";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const LanguageSkeleton: React.FC = () => (
  <div className="space-y-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-10 bg-muted rounded-md animate-pulse"></div>
    ))}
  </div>
);

const LanguageSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { selectedMovie, languages, isLoading, error } = useSelector(
    (state: RootState) => state.movie
  );

  useEffect(() => {
    if (selectedMovie) {
      dispatch(fetchLanguages(selectedMovie.imdbID));
    } else {
      navigate("/search");
    }
  }, [selectedMovie, dispatch, navigate]);

  const handleLanguageSelect = (language: Language) => {
    dispatch(setSelectedLanguage(language));
    navigate("/dubbing");
  };

  return (
    <PageLayout title="Select Language">
      {selectedMovie && (
        <div className="mb-6 animate-fade-in">
          <MovieCard movie={selectedMovie} />
        </div>
      )}

      <div className="mt-6 p-4 bg-card rounded-lg shadow-sm">
        {isLoading ? (
          <div className="animate-fade-in">
            <LanguageSkeleton />
            <div className="flex justify-center items-center mt-4">
              <LoadingSpinner />
              <p className="ml-2 text-sm text-muted-foreground">
                Loading languages...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 text-destructive bg-destructive/10 rounded-md animate-fade-in">
            Error: {error}
          </div>
        ) : languages.length > 0 ? (
          <div className="animate-fade-in">
            <LanguageSelector
              onSelectLanguage={handleLanguageSelect}
              languages={languages}
            />
          </div>
        ) : (
          <p className="text-muted-foreground bg-muted p-4 rounded-md animate-fade-in">
            No languages available for this movie.
          </p>
        )}
      </div>
    </PageLayout>
  );
};

export default LanguageSelectionPage;
