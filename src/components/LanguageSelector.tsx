import React, { useState } from "react";
import { ChevronDown, Star, Download } from "lucide-react";
import languageCodes from "@/lib/languageCodes";
import { Language } from "@/types";

interface LanguageSelectorProps {
  onSelectLanguage: (language: Language) => void;
  languages: Language[];
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onSelectLanguage,
  languages,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectLanguage = (language: Language) => {
    onSelectLanguage(language);
    setIsOpen(false);
  };

  if (languages.length === 0) {
    return null;
  }

  return (
    <div className="relative mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 border border-border rounded bg-input text-foreground flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span>Select a language</span>
        <ChevronDown className="w-4 h-4" />
      </button>
      {isOpen && (
        <ul className="absolute z-10 w-full mt-1 bg-background border border-border rounded shadow-lg max-h-60 overflow-auto">
          {languages.map((lang: Language) => (
            <li
              key={lang.id}
              onClick={() => handleSelectLanguage(lang)}
              className="p-2 hover:bg-accent hover:bg-opacity-10 cursor-pointer flex items-center justify-between text-foreground"
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
                  <Download className="w-4 h-4 text-primary mr-1" />
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
