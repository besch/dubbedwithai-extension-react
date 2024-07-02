import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import LanguageSelector from "@/components/LanguageSelector";
import { setSelectedLanguage, fetchLanguages } from "@/store/movieSlice";
import { Language } from "@/types";

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
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Select Language</h2>
      {selectedMovie && (
        <div className="mb-4">
          <h3 className="font-semibold">{selectedMovie.Title}</h3>
          <p className="text-sm text-gray-600">{selectedMovie.Year}</p>
        </div>
      )}
      {languages.length > 0 ? (
        <LanguageSelector
          onSelectLanguage={handleLanguageSelect}
          languages={languages}
        />
      ) : (
        <p>No languages available for this movie.</p>
      )}
    </div>
  );
};

export default LanguageSelectionPage;
