import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { PrecisionTimer } from "./PrecisionTimer";
import { DubbingConfig, DubbingMessage, Subtitle } from "./types";
import { log, LogLevel } from "./utils";

const DEFAULT_DUBBING_CONFIG: DubbingConfig = {
  defaultVolume: 1,
  dubbingVolume: 0.3,
  preloadTime: 5000, // 5 seconds
  preloadAudioGenerationTime: 15000, //15 seconds
  subtitleUpdateInterval: 0.5,
};

export class DubbingManager {
  private static instance: DubbingManager | null = null;
  private subtitleOffset: number = 0;
  private audioFileManager: AudioFileManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private audioContext: AudioContext;
  private originalVolume: number;
  private currentMovieId: string | null = null;
  private currentSubtitleId: string | null = null;
  private isDubbingPaused = false;
  private lastSentSubtitle: Subtitle | null = null;
  private lastSentTime: number = 0;
  private config: DubbingConfig;
  private precisionTimer: PrecisionTimer;
  private lastVideoTime: number = 0;

  private constructor(config: Partial<DubbingConfig> = {}) {
    this.config = { ...DEFAULT_DUBBING_CONFIG, ...config };
    this.precisionTimer = new PrecisionTimer(this.handlePreciseTime);
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.originalVolume = this.config.defaultVolume;
    this.setupMessageListener();
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.movieState) {
        const newMovieState = changes.movieState.newValue;
        if (newMovieState && typeof newMovieState.subtitleOffset === "number") {
          this.subtitleOffset = newMovieState.subtitleOffset * 1000; // Convert to milliseconds
        }
      }
    });
  }

  public static getInstance(
    config: Partial<DubbingConfig> = {}
  ): DubbingManager {
    if (!DubbingManager.instance) {
      DubbingManager.instance = new DubbingManager(config);
    }
    return DubbingManager.instance;
  }

  public async initialize(movieId: string, subtitleId: string): Promise<void> {
    if (
      this.currentMovieId === movieId &&
      this.currentSubtitleId === subtitleId &&
      this.subtitleManager.getCurrentSubtitles(0).length > 0
    ) {
      // Dubbing is already initialized, just resume
      this.isDubbingPaused = false;
      const video = document.querySelector("video") as HTMLVideoElement;
      if (video) {
        const currentTime = video.currentTime;
        this.precisionTimer.start(currentTime);
      }
      this.resumeDubbing();
    } else {
      // New initialization or subtitles not available
      this.stop(); // Reset state before new initialization
      this.currentMovieId = movieId;
      this.currentSubtitleId = subtitleId;
      this.isDubbingPaused = false;

      // Fetch subtitles
      const subtitles = await this.subtitleManager.getSubtitles(
        movieId,
        subtitleId
      );
      if (!subtitles || subtitles.length === 0) {
        throw new Error(
          `Failed to load subtitles for movie ${movieId} and subtitle ${subtitleId}`
        );
      }

      this.startDubbing();
    }
  }

  public resumeDubbing(): void {
    if (!this.isDubbingPaused) {
      return;
    }

    this.isDubbingPaused = false;

    // Resume the audio context
    this.audioContext.resume();

    // Get the current video time
    const video = document.querySelector("video") as HTMLVideoElement;
    if (!video) {
      console.error("No video element found");
      return;
    }

    const currentVideoTime = video.currentTime;

    this.precisionTimer.start(currentVideoTime);

    this.playCurrentSubtitles(currentVideoTime * 1000);

    this.checkAndGenerateUpcomingAudio(currentVideoTime * 1000);
  }

  public pauseDubbing(): void {
    this.isDubbingPaused = true;
    this.precisionTimer.pause();
    this.audioPlayer.stopAllAudio();
  }

  public async startDubbing(): Promise<void> {
    try {
      const subtitles = await this.subtitleManager.getSubtitles(
        this.currentMovieId!,
        this.currentSubtitleId!
      );
      if (subtitles && subtitles.length > 0) {
        this.findAndHandleVideo();
      } else {
        throw new Error(
          `Failed to load subtitles for movie ${this.currentMovieId} and subtitle ${this.currentSubtitleId}`
        );
      }
    } catch (error) {
      console.error("Error starting dubbing:", error);
      log(
        LogLevel.ERROR,
        `Error starting dubbing: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async stop(): Promise<void> {
    this.audioFileManager.stop();
    this.audioFileManager.clearCache();
    this.audioPlayer.stopAllAudio();
    this.subtitleManager.reset();
    this.currentMovieId = this.currentSubtitleId = null;
    this.isDubbingPaused = true; // Change this line
    this.lastSentSubtitle = null;
    this.lastSentTime = 0;
    this.precisionTimer.stop();

    // Remove event listeners from the main document's video element
    this.removeVideoEventListeners(document.querySelector("video"));

    // Remove event listeners from video elements in iframes
    const iframes = document.querySelectorAll("iframe");
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      try {
        const iframeDocument =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDocument) {
          const iframeVideo = iframeDocument.querySelector("video");
          if (iframeVideo) {
            this.removeVideoEventListeners(iframeVideo);
          }
        }
      } catch (e) {
        console.error("Could not access iframe content:", e);
      }
    }

    // Reset volume for all video elements
    this.resetAllVideoVolumes();
  }

  public isCurrentDubbing(movieId: string, subtitleId: string): boolean {
    return (
      this.currentMovieId === movieId && this.currentSubtitleId === subtitleId
    );
  }

  private resetAllVideoVolumes(): void {
    // Reset volume for the main document's video
    const mainVideo = document.querySelector("video");
    if (mainVideo) mainVideo.volume = this.originalVolume;

    // Reset volume for videos in iframes
    const iframes = document.querySelectorAll("iframe");
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      try {
        const iframeDocument =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDocument) {
          const iframeVideo = iframeDocument.querySelector("video");
          if (iframeVideo) iframeVideo.volume = this.originalVolume;
        }
      } catch (e) {
        console.error("Could not access iframe content:", e);
      }
    }
  }

  private removeVideoEventListeners(video: HTMLVideoElement | null): void {
    if (video) {
      video.removeEventListener("play", this.handleVideoPlay);
      video.removeEventListener("pause", this.handleVideoPause);
      video.removeEventListener("seeking", this.handleVideoSeeking);
      video.removeEventListener("volumechange", this.handleVolumeChange);
      video.removeEventListener("timeupdate", this.handleTimeUpdate);
    }
  }

  private async checkAndGenerateUpcomingAudio(
    currentTimeMs: number
  ): Promise<void> {
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      currentTimeMs,
      this.config.preloadAudioGenerationTime
    );

    for (const subtitle of upcomingSubtitles) {
      const filePath = this.getAudioFilePath(subtitle);
      const timeUntilPlay = subtitle.start - currentTimeMs;

      if (timeUntilPlay <= 15000 && timeUntilPlay > 0) {
        const exists = await this.audioFileManager.checkFileExists(filePath);
        if (!exists) {
          await this.audioFileManager.generateAudio(filePath, subtitle.text);
        }
      }
    }
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (message: DubbingMessage, sender, sendResponse) => {
        switch (message.action) {
          case "initializeDubbing":
            if (message.movieId && message.subtitleId) {
              this.initialize(message.movieId, message.subtitleId);
              sendResponse({ status: "initialized" });
            } else {
              sendResponse({
                status: "error",
                message: "Missing movieId or subtitleId",
              });
            }
            break;
          case "checkDubbingStatus":
            sendResponse({
              isDubbingActive:
                !!this.currentMovieId &&
                !!this.currentSubtitleId &&
                !this.isDubbingPaused,
            });
            break;
          case "updateDubbingState":
            if (message.payload) {
              this.isDubbingPaused = false; // Change this line
              this.resumeDubbing();
            } else {
              this.pauseDubbing();
            }
            sendResponse({ status: "updated" });
            break;
        }
        return true;
      }
    );
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
    if (this.isDubbingPaused) {
      this.resumeDubbing();
    }
  };

  private handleVideoPause = (): void => {
    // Only pause dubbing if it's not already paused
    if (!this.isDubbingPaused) {
      this.pauseDubbing();
    }
  };

  private handleVideoSeeking = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    this.precisionTimer.start(video.currentTime);
    if (!this.isDubbingPaused) {
      this.audioPlayer.stopAllAudio();
      this.playCurrentSubtitles(video.currentTime * 1000);
    }
  };

  private handleVolumeChange = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    if (
      this.subtitleManager.getCurrentSubtitles(video.currentTime * 1000)
        .length === 0
    ) {
      this.originalVolume = video.volume;
    }
  };

  private handleTimeUpdate = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const currentTime = video.currentTime;

    if (Math.abs(currentTime - this.lastVideoTime) >= 1) {
      this.lastVideoTime = currentTime;
      this.precisionTimer.start(currentTime);
    }
  };

  private handlePreciseTime = (time: number): void => {
    if (this.isDubbingPaused) {
      return;
    }

    const currentTimeMs = time * 1000;
    const adjustedTimeMs = currentTimeMs - this.subtitleOffset;

    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);

    this.adjustVolume(
      document.querySelector("video") as HTMLVideoElement,
      currentSubtitles
    );

    this.playCurrentSubtitles(currentTimeMs);
    this.audioPlayer.stopExpiredAudio(adjustedTimeMs);
    this.preloadUpcomingSubtitles(currentTimeMs);

    this.sendCurrentSubtitleInfo(adjustedTimeMs, currentSubtitles);

    this.checkAndGenerateUpcomingAudio(currentTimeMs);

    chrome.runtime.sendMessage({
      action: "updateCurrentTime",
      currentTime: currentTimeMs,
      adjustedTime: adjustedTimeMs,
    });
  };

  private async preloadUpcomingSubtitles(currentTime: number): Promise<void> {
    const adjustedTime = currentTime - this.subtitleOffset;
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      adjustedTime,
      this.config.preloadTime
    );

    for (const subtitle of upcomingSubtitles) {
      const filePath = this.getAudioFilePath(subtitle);
      try {
        if (this.audioFileManager.isGenerating(filePath)) {
          continue;
        }

        const exists = await this.audioFileManager.checkFileExists(filePath);
        if (exists) {
          await this.audioFileManager.getAudioBuffer(filePath);
        }
      } catch (error) {
        console.error(
          `Failed to preload audio for subtitle: ${subtitle.text}`,
          error
        );
      }
    }
  }

  private getAudioFilePath(subtitle: Subtitle): string {
    return `${this.currentMovieId}/${this.currentSubtitleId}/${subtitle.start}-${subtitle.end}.mp3`;
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

  private playCurrentSubtitles(currentTimeMs: number): void {
    const adjustedTimeMs = currentTimeMs - this.subtitleOffset;

    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);

    if (currentSubtitles.length === 0) {
      return;
    }

    currentSubtitles.forEach((subtitle) => {
      const audioFilePath = this.getAudioFilePath(subtitle);
      const startTimeMs = subtitle.start;

      if (
        adjustedTimeMs >= startTimeMs &&
        adjustedTimeMs < subtitle.end &&
        !this.audioPlayer.isAudioActive(audioFilePath)
      ) {
        const audioOffsetMs = Math.max(0, adjustedTimeMs - startTimeMs);
        this.playAudioIfAvailable(subtitle, audioOffsetMs / 1000);
      }
    });
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
      const startTime = currentSubtitle.start / 1000;
      const endTime = currentSubtitle.end / 1000;

      if (
        currentSubtitle !== this.lastSentSubtitle ||
        adjustedTime - this.lastSentTime >=
          this.config.subtitleUpdateInterval * 1000
      ) {
        chrome.runtime.sendMessage({
          action: "currentSubtitle",
          subtitle: {
            text: currentSubtitle.text,
            start: startTime,
            end: endTime,
            currentTime: adjustedTime / 1000,
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
