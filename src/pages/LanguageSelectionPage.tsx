import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import LanguageSelector from "@/components/LanguageSelector";
import { setSelectedLanguage, fetchLanguages } from "@/store/movieSlice";
import { Language } from "@/types";
import PageLayout from "@/components/ui/PageLayout";
import MovieCard from "@/components/MovieCard";

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

  if (isLoading) {
    return <div className="p-4">Loading languages...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <PageLayout title="Select Language">
      {selectedMovie && <MovieCard movie={selectedMovie} />}
      {languages.length > 0 ? (
        <LanguageSelector
          onSelectLanguage={handleLanguageSelect}
          languages={languages}
        />
      ) : (
        <p className="text-gray-600">No languages available for this movie.</p>
      )}
    </PageLayout>
  );
};

export default LanguageSelectionPage;
