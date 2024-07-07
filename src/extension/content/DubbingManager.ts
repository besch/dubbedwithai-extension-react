import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { DubbingConfig, Subtitle } from "./types";
import { getAudioFileName, log, timeStringToSeconds, LogLevel } from "./utils";

const DEFAULT_DUBBING_CONFIG: DubbingConfig = {
  defaultVolume: 1,
  dubbingVolume: 0.3,
  preloadTime: 5,
  subtitleUpdateInterval: 0.5,
};

export class DubbingManager {
  private audioFileManager: AudioFileManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private audioContext: AudioContext;
  private originalVolume: number;
  private currentMovieId: string | null = null;
  private currentSubtitleId: string | null = null;
  private isVideoPaused = false;
  private lastSentSubtitle: Subtitle | null = null;
  private lastSentTime: number = 0;
  private config: DubbingConfig;

  constructor(config: Partial<DubbingConfig> = {}) {
    this.config = { ...DEFAULT_DUBBING_CONFIG, ...config };
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.originalVolume = this.config.defaultVolume;
    this.setupMessageListener();
  }

  initialize(movieId: string, subtitleId: string): void {
    this.currentMovieId = movieId;
    this.currentSubtitleId = subtitleId;
    this.startDubbing();
  }

  private async startDubbing(): Promise<void> {
    try {
      const subtitles = await this.subtitleManager.getSubtitles(
        this.currentMovieId!,
        this.currentSubtitleId!
      );
      if (subtitles) {
        this.findAndHandleVideo();
      } else {
        throw new Error(
          `Failed to load subtitles for movie ${this.currentMovieId} and subtitle ${this.currentSubtitleId}`
        );
      }
    } catch (error) {
      log(
        LogLevel.ERROR,
        `Error starting dubbing: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  stop(): void {
    this.audioFileManager.clearCache();
    this.audioPlayer.stopAllAudio();
    this.subtitleManager.reset();
    this.currentMovieId = this.currentSubtitleId = null;
    this.isVideoPaused = false;
    this.lastSentSubtitle = null;
    this.lastSentTime = 0;
    const video = document.querySelector("video");
    if (video) video.volume = this.originalVolume;
    this.removeVideoEventListeners();
    log(LogLevel.INFO, "Dubbing stopped");
  }

  private removeVideoEventListeners(): void {
    const video = document.querySelector("video");
    if (video) {
      video.removeEventListener("play", this.handleVideoPlay);
      video.removeEventListener("pause", this.handleVideoPause);
      video.removeEventListener("seeking", this.handleVideoSeeking);
      video.removeEventListener("volumechange", this.handleVolumeChange);
      video.removeEventListener("timeupdate", this.handleTimeUpdate);
    }
  }

  private async getAudioBuffer(fileName: string): Promise<AudioBuffer | null> {
    return this.audioFileManager.getAudioBuffer(
      this.currentMovieId!,
      this.currentSubtitleId!,
      fileName
    );
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (message: { action: string; movieId?: string; subtitleId?: string }) => {
        switch (message.action) {
          case "initializeDubbing":
            if (message.movieId && message.subtitleId) {
              this.initialize(message.movieId, message.subtitleId);
            } else {
              log(
                LogLevel.ERROR,
                "Missing movieId or subtitleId for initialization"
              );
            }
            break;
          case "stopDubbing":
            this.stop();
            break;
          case "checkDubbingStatus":
            this.checkAndApplyDubbing();
            break;
        }
      }
    );
  }

  private checkAndApplyDubbing(): void {
    chrome.storage.local.get(["movieState"], (result) => {
      const movieState = result.movieState;
      if (
        movieState?.isDubbingActive &&
        movieState.selectedMovie &&
        movieState.selectedLanguage
      ) {
        this.initialize(
          movieState.selectedMovie.imdbID,
          movieState.selectedLanguage.id
        );
      }
    });
  }

  private async handleApplyDubbing(
    movieId: string,
    subtitleId: string
  ): Promise<void> {
    this.currentMovieId = movieId;
    this.currentSubtitleId = subtitleId;

    try {
      const subtitles = await this.subtitleManager.getSubtitles(
        movieId,
        subtitleId
      );
      if (subtitles) {
        this.findAndHandleVideo();
      } else {
        throw new Error(
          `Failed to load subtitles for movie ${movieId} and subtitle ${subtitleId}`
        );
      }
    } catch (error) {
      log(
        LogLevel.ERROR,
        `Error applying dubbing: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private handleVideo(video: HTMLVideoElement): void {
    this.originalVolume = video.volume;
    video.addEventListener("play", this.handleVideoPlay);
    video.addEventListener("pause", this.handleVideoPause);
    video.addEventListener("seeking", this.handleVideoSeeking);
    video.addEventListener("volumechange", this.handleVolumeChange);
    video.addEventListener("timeupdate", this.handleTimeUpdate);
  }

  private handleVideoPlay = (event: Event): void => {
    this.isVideoPaused = false;
    this.audioPlayer.stopAllAudio();
    this.playCurrentSubtitles((event.target as HTMLVideoElement).currentTime);
  };

  private handleVideoPause = (): void => {
    this.isVideoPaused = true;
    this.audioPlayer.stopAllAudio();
  };

  private handleVideoSeeking = (event: Event): void => {
    this.audioPlayer.stopAllAudio();
    if (!this.isVideoPaused) {
      this.playCurrentSubtitles((event.target as HTMLVideoElement).currentTime);
    }
  };

  private handleVolumeChange = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    if (
      this.subtitleManager.getCurrentSubtitles(video.currentTime).length === 0
    ) {
      this.originalVolume = video.volume;
    }
  };

  private handleTimeUpdate = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const currentTime = video.currentTime;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(currentTime);

    this.adjustVolume(video, currentSubtitles);
    if (!this.isVideoPaused) {
      this.playCurrentSubtitles(currentTime);
    }
    this.audioPlayer.stopExpiredAudio(currentTime);
    this.preloadUpcomingSubtitles(currentTime);

    this.sendCurrentSubtitleInfo(currentTime, currentSubtitles);
  };

  private adjustVolume(
    video: HTMLVideoElement,
    currentSubtitles: Subtitle[]
  ): void {
    video.volume =
      currentSubtitles.length > 0
        ? this.config.dubbingVolume
        : this.originalVolume;
  }

  private playCurrentSubtitles(currentTime: number): void {
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(currentTime);
    currentSubtitles.forEach((subtitle) => {
      const audioFileName = getAudioFileName(subtitle);
      const startTime = timeStringToSeconds(subtitle.start);
      const endTime = timeStringToSeconds(subtitle.end);

      if (
        currentTime >= startTime &&
        currentTime < endTime &&
        !this.audioPlayer.isAudioActive(audioFileName)
      ) {
        this.playAudioIfAvailable(
          audioFileName,
          subtitle,
          currentTime - startTime
        );
      }
    });
  }

  private preloadUpcomingSubtitles(currentTime: number): void {
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      currentTime,
      this.config.preloadTime
    );
    upcomingSubtitles.forEach((subtitle) => {
      const audioFileName = getAudioFileName(subtitle);
      this.getAudioBuffer(audioFileName);
    });
  }

  private async playAudioIfAvailable(
    fileName: string,
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    try {
      const buffer = await this.getAudioBuffer(fileName);
      if (buffer) {
        await this.audioPlayer.playAudio(buffer, fileName, subtitle, offset);
      } else {
        log(LogLevel.WARN, `Audio buffer not available for file: ${fileName}`);
      }
    } catch (error) {
      log(LogLevel.ERROR, `Error playing audio for file: ${fileName}`, error);
    }
  }

  private sendCurrentSubtitleInfo(
    currentTime: number,
    currentSubtitles: Subtitle[]
  ): void {
    if (currentSubtitles.length > 0) {
      const currentSubtitle = currentSubtitles[0];
      const startTime = timeStringToSeconds(currentSubtitle.start);
      const endTime = timeStringToSeconds(currentSubtitle.end);

      if (
        currentSubtitle !== this.lastSentSubtitle ||
        currentTime - this.lastSentTime >= this.config.subtitleUpdateInterval
      ) {
        chrome.runtime.sendMessage({
          action: "currentSubtitle",
          subtitle: {
            text: currentSubtitle.text,
            start: startTime,
            end: endTime,
            currentTime,
          },
        });

        this.lastSentSubtitle = currentSubtitle;
        this.lastSentTime = currentTime;
      }
    } else if (this.lastSentSubtitle !== null) {
      chrome.runtime.sendMessage({ action: "currentSubtitle", subtitle: null });
      this.lastSentSubtitle = null;
    }
  }

  private findAndHandleVideo(): void {
    let video = document.querySelector("video");

    if (video) {
      this.handleVideo(video);
      return;
    }

    const iframes = document.querySelectorAll("iframe");
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      try {
        const iframeDocument =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDocument) {
          video = iframeDocument.querySelector("video");
          if (video) {
            this.handleVideo(video);
            return;
          }
        }
      } catch (e) {
        console.error("Could not access iframe content:", e);
      }
    }

    this.setupVideoObserver();
  }

  private setupVideoObserver(): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const video = document.querySelector("video");
          if (video) {
            this.handleVideo(video);
            observer.disconnect();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}
