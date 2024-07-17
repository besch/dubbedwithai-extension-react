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
import { toast } from "react-toastify";

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
    toast.success(`Selected language: ${language.attributes.language}`);
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
          <div className="animate-fade-in flex flex-col items-center">
            <LoadingSpinner />
            <p className="mt-4 text-sm text-muted-foreground">
              Loading languages...
            </p>
          </div>
        ) : error ? (
          toast.error(`Error: ${error}`)
        ) : languages.length > 0 ? (
          <div className="animate-fade-in">
            <LanguageSelector
              onSelectLanguage={handleLanguageSelect}
              languages={languages}
            />
          </div>
        ) : (
          toast.info("No languages available for this movie.")
        )}
      </div>
    </PageLayout>
  );
};

export default LanguageSelectionPage;
