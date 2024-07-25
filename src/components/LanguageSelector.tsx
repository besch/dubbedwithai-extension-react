import React, { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Language } from "@/types";

interface LanguageSelectorProps {
  onSelectLanguage: (languageCode: string) => void;
  languages: Language[];
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  onSelectLanguage,
  languages,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSelectLanguage = (languageCode: string) => {
    onSelectLanguage(languageCode);
    setIsOpen(false);
  };

  const filteredLanguages = useMemo(() => {
    if (!Array.isArray(languages)) {
      console.error("Languages is not an array:", languages);
      return [];
    }
    return languages.filter((lang) =>
      lang.attributes.language_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
  }, [languages, searchQuery]);

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
            {filteredLanguages.map((lang) => (
              <li
                key={lang.id}
                onClick={() => handleSelectLanguage(lang.id)}
                className="p-2 hover:bg-accent hover:bg-opacity-10 cursor-pointer flex items-center justify-between text-foreground"
              >
                <span>{lang.attributes.language_name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
