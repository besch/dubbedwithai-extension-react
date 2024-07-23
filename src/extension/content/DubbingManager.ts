import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { PrecisionTimer } from "./PrecisionTimer";
import { DubbingMessage, Subtitle } from "./types";
import { log, LogLevel } from "./utils";
import config from "./config";

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
  private precisionTimer: PrecisionTimer;
  private lastVideoTime: number = 0;
  private isDubbingAudioPlaying: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    this.precisionTimer = new PrecisionTimer(this.handlePreciseTime);
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.originalVolume = config.defaultVolume;
    this.setupMessageListener();
    this.setupVolumeCheck();
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.movieState) {
        const newMovieState = changes.movieState.newValue;
        if (newMovieState && typeof newMovieState.subtitleOffset === "number") {
          this.subtitleOffset = newMovieState.subtitleOffset * 1000; // Convert to milliseconds
        }
      }
    });
  }

  public static getInstance(): DubbingManager {
    if (!DubbingManager.instance) {
      DubbingManager.instance = new DubbingManager();
    }
    return DubbingManager.instance;
  }

  public async initialize(movieId: string, subtitleId: string): Promise<void> {
    if (this.isInitialized) {
      console.log("DubbingManager is already initialized. Reinitializing...");
      await this.stop();
    }

    this.currentMovieId = movieId;
    this.currentSubtitleId = subtitleId;
    this.isDubbingPaused = false;

    try {
      const subtitles = await this.subtitleManager.getSubtitles(
        movieId,
        subtitleId
      );
      if (!subtitles || subtitles.length === 0) {
        throw new Error(
          `Failed to load subtitles for movie ${movieId} and subtitle ${subtitleId}`
        );
      }

      this.findAndStoreVideoElement();

      if (this.videoElement) {
        this.lastSentSubtitle = null;
        this.lastSentTime = 0;
        this.lastVideoTime = 0;
        this.isDubbingAudioPlaying = false;

        this.audioContext = new window.AudioContext();
        this.audioFileManager = new AudioFileManager(this.audioContext);
        this.audioPlayer = new AudioPlayer(this.audioContext);

        await this.startDubbing();
        this.isInitialized = true;
        console.log("DubbingManager initialized successfully");
      } else {
        console.warn("No video element found. Setting up observer.");
        this.setupVideoObserver();
      }
    } catch (error) {
      console.error("Error during initialization:", error);
      this.isInitialized = false;
      throw error;
    }
  }

  public resumeDubbing(): void {
    if (!this.isDubbingPaused) {
      return;
    }

    this.isDubbingPaused = false;
    this.audioContext.resume();

    if (!this.videoElement) {
      console.error("No video element found");
      return;
    }

    const currentVideoTime = this.videoElement.currentTime;

    this.precisionTimer.start(currentVideoTime);

    // Reset volume to original when resuming
    this.videoElement.volume = this.originalVolume;

    this.playCurrentSubtitles(currentVideoTime * 1000);

    this.checkAndGenerateUpcomingAudio(currentVideoTime * 1000);
  }

  public pauseDubbing(): void {
    this.isDubbingPaused = true;
    this.precisionTimer.pause();
    this.audioPlayer.stopAllAudio();

    if (this.videoElement) {
      this.videoElement.volume = this.originalVolume;
    }
  }

  private setupVolumeCheck(): void {
    setInterval(() => {
      if (
        this.videoElement &&
        !this.isAnyDubbingAudioPlaying() &&
        !this.isDubbingPaused
      ) {
        this.videoElement.volume = this.originalVolume;
      }
    }, 1000); // Check every second
  }

  private async startDubbing(): Promise<void> {
    try {
      const subtitles = await this.subtitleManager.getSubtitles(
        this.currentMovieId!,
        this.currentSubtitleId!
      );
      if (subtitles && subtitles.length > 0) {
        // Start the actual dubbing process
        this.precisionTimer.start(this.videoElement!.currentTime);
        this.playCurrentSubtitles(this.videoElement!.currentTime * 1000);
        console.log("Dubbing started successfully");
      } else {
        throw new Error("No subtitles available for dubbing");
      }
    } catch (error) {
      console.error("Error starting dubbing:", error);
      log(
        LogLevel.ERROR,
        `Error starting dubbing: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.audioFileManager.stop();
    this.audioFileManager.clearCache();
    this.audioPlayer.stopAllAudio();
    this.subtitleManager.reset();
    this.currentMovieId = this.currentSubtitleId = null;
    this.isDubbingPaused = true;
    this.lastSentSubtitle = null;
    this.lastSentTime = 0;
    this.precisionTimer.stop();
    this.removeVideoEventListeners();
    this.resetVideoVolume();
    if (this.videoElement) {
      this.videoElement.volume = this.originalVolume;
    }
    this.videoElement = null;
    this.isInitialized = false;
    console.log("DubbingManager stopped and reset");
  }

  private resetVideoVolume(): void {
    if (this.videoElement) {
      this.videoElement.volume = this.originalVolume;
    }
  }

  public isCurrentDubbing(movieId: string, subtitleId: string): boolean {
    return (
      this.currentMovieId === movieId && this.currentSubtitleId === subtitleId
    );
  }

  private findAndStoreVideoElement(): void {
    // Check in the main document
    this.videoElement = document.querySelector("video");

    if (this.videoElement) {
      this.handleVideo(this.videoElement);
      return;
    }

    // Check in iframes
    const iframes = document.querySelectorAll("iframe");
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      try {
        const iframeDocument =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDocument) {
          this.videoElement = iframeDocument.querySelector("video");
          if (this.videoElement) {
            this.handleVideo(this.videoElement);
            return;
          }
        }
      } catch (e) {
        console.error("Could not access iframe content:", e);
      }
    }

    // If no video found, set up an observer
    this.setupVideoObserver();
  }

  private removeVideoEventListeners(): void {
    if (this.videoElement) {
      this.videoElement.removeEventListener("play", this.handleVideoPlay);
      this.videoElement.removeEventListener("pause", this.handleVideoPause);
      this.videoElement.removeEventListener("seeking", this.handleVideoSeeking);
      this.videoElement.removeEventListener(
        "volumechange",
        this.handleVolumeChange
      );
      this.videoElement.removeEventListener(
        "timeupdate",
        this.handleTimeUpdate
      );
    }
  }

  private async checkAndGenerateUpcomingAudio(
    currentTimeMs: number
  ): Promise<void> {
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      currentTimeMs,
      config.preloadAudioGenerationTime
    );

    for (const subtitle of upcomingSubtitles) {
      const filePath = this.getAudioFilePath(subtitle);
      const timeUntilPlay = subtitle.start - currentTimeMs;

      if (
        timeUntilPlay <= config.preloadAudioGenerationTime &&
        timeUntilPlay > 0
      ) {
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
    this.videoElement = video;
    this.originalVolume = video.volume;
    video.addEventListener("play", this.handleVideoPlay);
    video.addEventListener("pause", this.handleVideoPause);
    video.addEventListener("seeking", this.handleVideoSeeking);
    video.addEventListener("volumechange", this.handleVolumeChange);
    video.addEventListener("timeupdate", this.handleTimeUpdate);
  }

  private handleVideoPlay = (): void => {
    if (this.isDubbingPaused) {
      this.resumeDubbing();
    }
    if (!this.isDubbingAudioPlaying && this.videoElement) {
      this.videoElement.volume = this.originalVolume;
    }
  };

  private handleVideoPause = (): void => {
    if (!this.isDubbingPaused) {
      this.pauseDubbing();
    }
    if (this.videoElement) {
      this.videoElement.volume = this.originalVolume;
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

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }

    this.playCurrentSubtitles(currentTimeMs);
    this.audioPlayer.stopExpiredAudio(adjustedTimeMs);
    this.preloadUpcomingSubtitles(currentTimeMs);

    this.sendCurrentSubtitleInfo(
      adjustedTimeMs,
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs)
    );

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
      config.preloadAudioTime
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

  private adjustVolume(video: HTMLVideoElement | null): void {
    if (!video) return;

    const shouldLowerVolume = this.isAnyDubbingAudioPlaying();

    video.volume = shouldLowerVolume
      ? config.dubbingVolume
      : this.originalVolume;

    console.log(
      `Adjusting volume: ${video.volume}, isDubbingAudioPlaying: ${shouldLowerVolume}`
    );
  }

  private isAnyDubbingAudioPlaying(): boolean {
    return this.audioPlayer.getCurrentlyPlayingSubtitles().length > 0;
  }

  private async playCurrentSubtitles(currentTimeMs: number): Promise<void> {
    const adjustedTimeMs = currentTimeMs - this.subtitleOffset;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);

    for (const subtitle of currentSubtitles) {
      const audioFilePath = this.getAudioFilePath(subtitle);
      const startTimeMs = subtitle.start;

      if (
        adjustedTimeMs >= startTimeMs &&
        adjustedTimeMs < subtitle.end &&
        !this.audioPlayer.isAudioActive(audioFilePath)
      ) {
        const audioOffsetMs = Math.max(0, adjustedTimeMs - startTimeMs);
        await this.playAudioIfAvailable(subtitle, audioOffsetMs / 1000);
      }
    }

    // Always adjust volume after playing subtitles
    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
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
        adjustedTime - this.lastSentTime >= config.subtitleUpdateInterval * 1000
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

  private setupVideoObserver(): void {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          this.videoElement = document.querySelector("video");
          if (this.videoElement) {
            this.handleVideo(this.videoElement);
            observer.disconnect();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}
