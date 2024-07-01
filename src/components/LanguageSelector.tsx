import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setSelectedLanguage } from "@/store/movieSlice";
import { Star, Download, ChevronDown } from "lucide-react";
import languageCodes from "@/lib/languageCodes";
import { Language } from "@/types";

const LanguageSelector: React.FC = () => {
  const dispatch = useDispatch();
  const { selectedLanguage, languages } = useSelector(
    (state: RootState) => state.movie
  );
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectLanguage = (language: Language) => {
    dispatch(setSelectedLanguage(language));
    setIsOpen(false);
  };

  if (languages.length === 0) {
    return null;
  }

  return (
    <div className="relative mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border rounded bg-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span>
          {selectedLanguage
            ? languageCodes[selectedLanguage.attributes.language] ||
              selectedLanguage.attributes.language
            : "Select a language"}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {isOpen && (
        <ul className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-60 overflow-auto">
          {languages.map((lang: Language) => (
            <li
              key={lang.id}
              onClick={() => handleSelectLanguage(lang)}
              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
            >
              <span>
                {languageCodes[lang.attributes.language] ||
                  lang.attributes.language}
              </span>
              <div className="flex items-center space-x-2 text-sm">
                <span className="flex items-center">
                  <Star className="w-4 h-4 text-yellow-500 mr-1" />
                  {lang.attributes.ratings.toFixed(1)}
                </span>
                <span className="flex items-center">
                  <Download className="w-4 h-4 text-blue-500 mr-1" />
                  {lang.attributes.download_count.toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageSelector;
