import React from "react";

interface Language {
  id: string;
  attributes: {
    language: string;
    ratings: number;
    download_count: number;
  };
}

interface LanguageSelectorProps {
  languages: Language[];
  selectedLanguage: Language | null;
  onSelectLanguage: (language: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  languages,
  selectedLanguage,
  onSelectLanguage,
}) => (
  <select
    value={selectedLanguage ? selectedLanguage.attributes.language : ""}
    onChange={(e) => {
      const selectedLang = languages.find(
        (lang) => lang.attributes.language === e.target.value
      );
      if (selectedLang) onSelectLanguage(selectedLang);
    }}
    className="mt-2 w-full p-2 border rounded"
  >
    <option value="">Select a language</option>
    {languages.map((lang) => (
      <option key={lang.id} value={lang.attributes.language}>
        {lang.attributes.language} --- Rating: {lang.attributes.ratings},
        Downloads: {lang.attributes.download_count}
      </option>
    ))}
  </select>
);

export default LanguageSelector;
