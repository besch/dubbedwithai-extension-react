import React, { useState, useMemo } from "react";
import { ChevronDown, Star, Download, Search } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");

  const handleSelectLanguage = (language: Language) => {
    onSelectLanguage(language);
    setIsOpen(false);
  };

  const filteredLanguages = useMemo(() => {
    return languages.filter((lang) =>
      languageCodes[lang.attributes.language]
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
  }, [languages, searchQuery]);

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
        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded shadow-lg">
          <div className="p-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-2 pl-8 border border-border rounded bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground opacity-50" />
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {filteredLanguages.map((lang: Language) => (
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
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
