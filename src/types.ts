export interface Movie {
  imdbID: string;
  Title: string;
  Year: string;
  Type: string;
  Poster: string;
}

export interface Language {
  id: string;
  attributes: {
    language: string;
    language_name: string;
    ratings?: number;
    download_count?: number;
    subtitle_id?: string;
    files?: Array<{
      file_id: string;
      format: string;
      download_count: number;
    }>;
  };
}
