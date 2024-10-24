export interface Movie {
  imdbID: string;
  Title: string;
  Year: string;
  Type: "movie" | "series";
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

export interface DubbingConfig {
  defaultVolume: number;
  dubbingVolume: number;
  preloadTime: number;
  preloadAudioGenerationTime: number;
  subtitleUpdateInterval: number;
}

export interface Subtitle {
  start: number;
  end: number;
  text: string;
}

export type DubbingMessage =
  | {
      action: "initializeDubbing";
      movieId: string | null;
      languageCode: string | null;
      srtContent: string;
      seasonNumber?: number;
      episodeNumber?: number;
    }
  | { action: "stopDubbing" }
  | { action: "toggleDubbing" }
  | { action: "checkDubbingStatus" }
  | { action: "updateDubbingState"; payload: boolean }
  | {
      action: "applySettingsChanges";
      payload: {
        subtitleOffset: number;
        dubbingVolumeMultiplier: number;
        videoVolumeWhilePlayingDubbing: number;
        dubbingVoice: DubbingVoice;
      };
    };

export interface StorageData {
  isDubbingActive?: boolean;
  movieId?: string | null;
  languageCode?: string | null;
  srtContent: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export type DubbingVoice =
  | "en-US-JennyNeural"
  | "en-US-GuyNeural"
  | "en-US-AmberNeural"
  | "en-US-ChristopherNeural"
  | "en-US-AriaNeural"
  | "en-US-JaneNeural"
  | "es-ES-ElviraNeural"
  | "es-ES-AlvaroNeural"
  | "fr-FR-DeniseNeural"
  | "fr-FR-HenriNeural"
  | "de-DE-KatjaNeural"
  | "de-DE-ConradNeural"
  | "it-IT-ElsaNeural"
  | "it-IT-DiegoNeural"
  | "ja-JP-NanamiNeural"
  | "ja-JP-KeitaNeural"
  | "ko-KR-SunHiNeural"
  | "ko-KR-InJoonNeural"
  | "pt-BR-FranciscaNeural"
  | "pt-BR-AntonioNeural"
  | "ru-RU-SvetlanaNeural"
  | "ru-RU-DmitryNeural"
  | "zh-CN-XiaoxiaoNeural"
  | "zh-CN-YunxiNeural";
