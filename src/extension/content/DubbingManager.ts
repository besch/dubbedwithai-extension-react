import { throttle } from "lodash";
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
  private subtitleOffset: number = 0;
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
  private lastGeneratedTime: number = 0;
  private generationInterval: number = 30;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private audioGenerationQueue: Set<string> = new Set();

  private throttledGenerateUpcomingDubbings: ReturnType<typeof throttle>;

  constructor(config: Partial<DubbingConfig> = {}) {
    this.config = { ...DEFAULT_DUBBING_CONFIG, ...config };
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.originalVolume = this.config.defaultVolume;
    this.setupMessageListener();
    this.throttledGenerateUpcomingDubbings = throttle(
      this.generateUpcomingDubbings.bind(this),
      60000, // Allow only one call per minute
      { leading: true, trailing: false }
    );
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.movieState) {
        const newMovieState = changes.movieState.newValue;
        if (newMovieState && typeof newMovieState.subtitleOffset === "number") {
          this.subtitleOffset = newMovieState.subtitleOffset;
        }
      }
    });
  }

  initialize(movieId: string, subtitleId: string): void {
    this.currentMovieId = movieId;
    this.currentSubtitleId = subtitleId;
    this.startDubbing();
  }

  private async requestAudioGeneration(subtitle: Subtitle): Promise<void> {
    return new Promise((resolve, reject) => {
      const audioFilePath = this.getAudioFilePath(subtitle);
      chrome.runtime.sendMessage(
        {
          action: "generateAudio",
          movieId: this.currentMovieId,
          subtitleId: this.currentSubtitleId,
          text: subtitle.text,
          filePath: audioFilePath,
        },
        (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve();
          }
        }
      );
    });
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

  async stop(): Promise<void> {
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
    const adjustedTime = currentTime - this.subtitleOffset;

    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTime);

    this.adjustVolume(video, currentSubtitles);
    if (!this.isVideoPaused) {
      this.playCurrentSubtitles(currentTime);
    }
    this.audioPlayer.stopExpiredAudio(adjustedTime);
    this.preloadUpcomingSubtitles(currentTime);

    this.sendCurrentSubtitleInfo(adjustedTime, currentSubtitles);

    // Generate upcoming dubbings if needed
    this.throttledGenerateUpcomingDubbings(currentTime);

    chrome.runtime.sendMessage({
      action: "updateCurrentTime",
      currentTime: currentTime,
      adjustedTime: adjustedTime,
    });
  };

  private async generateUpcomingDubbings(currentTime: number): Promise<void> {
    if (!this.currentMovieId || !this.currentSubtitleId) return;

    const currentTimestamp = Date.now();
    if (currentTimestamp - this.lastGeneratedTime < this.generationInterval) {
      return;
    }
    this.lastGeneratedTime = currentTimestamp;

    const oneMinuteAhead = currentTime + 60; // 60 seconds ahead
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      currentTime,
      60
    );

    for (const subtitle of upcomingSubtitles) {
      const audioFilePath = this.getAudioFilePath(subtitle);
      const cacheKey = audioFilePath;

      if (this.audioGenerationQueue.has(cacheKey)) {
        continue; // Skip if already in queue
      }

      const fileExists = await this.audioFileManager.checkFileExists(
        audioFilePath
      );

      if (!fileExists) {
        this.audioGenerationQueue.add(cacheKey);
        this.requestAudioGenerationWithRetry(subtitle, cacheKey);
      }
    }
  }

  private async requestAudioGenerationWithRetry(
    subtitle: Subtitle,
    cacheKey: string,
    retryCount: number = 0
  ): Promise<void> {
    try {
      await this.requestAudioGeneration(subtitle);
      this.audioGenerationQueue.delete(cacheKey);
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.requestAudioGenerationWithRetry(
          subtitle,
          cacheKey,
          retryCount + 1
        );
      } else {
        log(
          LogLevel.ERROR,
          `Failed to generate audio after ${this.maxRetries} retries:`,
          error
        );
        this.audioGenerationQueue.delete(cacheKey);
      }
    }
  }

  private getAudioFileName(subtitle: Subtitle): string {
    const startMs = this.timeStringToMs(subtitle.start);
    const endMs = this.timeStringToMs(subtitle.end);
    return `${startMs}-${endMs}.mp3`;
  }

  private timeStringToMs(timeString: string): number {
    const [hours, minutes, secondsAndMs] = timeString.split(":");
    const [seconds, ms] = secondsAndMs.split(",");
    return (
      parseInt(hours) * 3600000 +
      parseInt(minutes) * 60000 +
      parseInt(seconds) * 1000 +
      parseInt(ms)
    );
  }

  private async preloadUpcomingSubtitles(currentTime: number): Promise<void> {
    const adjustedTime = currentTime - this.subtitleOffset;
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      adjustedTime,
      this.config.preloadTime
    );

    for (const subtitle of upcomingSubtitles) {
      const filePath = this.getAudioFilePath(subtitle);
      await this.audioFileManager.getAudioBuffer(filePath);
    }
  }

  private getAudioFilePath(subtitle: Subtitle): string {
    const startMs = this.timeStringToMs(subtitle.start);
    const endMs = this.timeStringToMs(subtitle.end);
    return `${this.currentMovieId}/${this.currentSubtitleId}/${startMs}-${endMs}.mp3`;
  }

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
    const adjustedTime = currentTime - this.subtitleOffset;

    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTime);
    currentSubtitles.forEach((subtitle) => {
      const audioFilePath = this.getAudioFilePath(subtitle);
      const startTime = this.timeStringToMs(subtitle.start) / 1000; // Convert to seconds
      const endTime = this.timeStringToMs(subtitle.end) / 1000; // Convert to seconds

      if (
        adjustedTime >= startTime &&
        adjustedTime < endTime &&
        !this.audioPlayer.isAudioActive(audioFilePath)
      ) {
        const audioOffset = Math.max(0, adjustedTime - startTime);
        this.playAudioIfAvailable(subtitle, audioOffset);
      }
    });
  }

  private timeStringToSeconds(timeString: string): number {
    const [hours, minutes, seconds] = timeString.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private async playAudioIfAvailable(
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const filePath = this.getAudioFilePath(subtitle);
    try {
      const buffer = await this.audioFileManager.getAudioBuffer(filePath);
      if (buffer) {
        await this.audioPlayer.playAudio(buffer, filePath, subtitle, offset);
      } else {
        log(LogLevel.WARN, `Audio buffer not available for file: ${filePath}`);
      }
    } catch (error) {
      log(LogLevel.ERROR, `Error playing audio for file: ${filePath}`, error);
    }
  }

  private sendCurrentSubtitleInfo(
    adjustedTime: number,
    currentSubtitles: Subtitle[]
  ): void {
    if (currentSubtitles.length > 0) {
      const currentSubtitle = currentSubtitles[0];
      const startTime = this.timeStringToSeconds(currentSubtitle.start);
      const endTime = this.timeStringToSeconds(currentSubtitle.end);

      if (
        currentSubtitle !== this.lastSentSubtitle ||
        adjustedTime - this.lastSentTime >= this.config.subtitleUpdateInterval
      ) {
        chrome.runtime.sendMessage({
          action: "currentSubtitle",
          subtitle: {
            text: currentSubtitle.text,
            start: startTime,
            end: endTime,
            currentTime: adjustedTime,
          },
        });

        this.lastSentSubtitle = currentSubtitle;
        this.lastSentTime = adjustedTime;
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
