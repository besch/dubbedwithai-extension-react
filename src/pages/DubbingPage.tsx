import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "@/store";
import DubbingControls from "@/components/DubbingControls";
import CurrentSubtitle from "@/components/CurrentSubtitle";
import { setIsDubbingActive } from "@/store/movieSlice";
import languageCodes from "@/lib/languageCodes"; // Import languageCodes

const DubbingPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { selectedMovie, selectedLanguage, isDubbingActive } = useSelector(
    (state: RootState) => state.movie
  );

  const handleDubbingToggle = (isActive: boolean) => {
    dispatch(setIsDubbingActive(isActive));
  };

  const handleBackToSearch = () => {
    navigate("/search");
  };

  // Function to get full language name
  const getFullLanguageName = (languageCode: string): string => {
    return languageCodes[languageCode] || languageCode;
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Dubbing Controls</h2>
      {selectedMovie && selectedLanguage && (
        <div className="mb-4">
          <h3 className="font-semibold">{selectedMovie.Title}</h3>
          <p className="text-sm text-gray-600">{selectedMovie.Year}</p>
          <p className="text-sm text-gray-600">
            Language:{" "}
            {getFullLanguageName(selectedLanguage.attributes.language)}
          </p>
        </div>
      )}
      <DubbingControls
        isDubbingActive={isDubbingActive}
        onDubbingToggle={handleDubbingToggle}
      />
      <button
        onClick={handleBackToSearch}
        className="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition duration-200"
      >
        Back to Search
      </button>
      <CurrentSubtitle />
    </div>
  );
};

export default DubbingPage;
