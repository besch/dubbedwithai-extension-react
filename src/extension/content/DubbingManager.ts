import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { PrecisionTimer } from "./PrecisionTimer";
import { DubbingMessage, Subtitle } from "@/types";
import { log, LogLevel } from "./utils";
import config from "./config";
import { parseSrt } from "../utils";

export class DubbingManager {
  private static instance: DubbingManager | null = null;
  private subtitleOffset: number = 0;
  private audioFileManager: AudioFileManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private audioContext: AudioContext;
  private currentMovieId: string | null = null;
  private currentLanguageCode: string | null = null;
  private currentSeasonNumber: number | null = null;
  private currentEpisodeNumber: number | null = null;
  private isDubbingPaused = false;
  private lastSentSubtitle: Subtitle | null = null;
  private lastSentTime: number = 0;
  private precisionTimer: PrecisionTimer;
  private lastVideoTime: number = 0;
  private videoElement: HTMLVideoElement | null = null;
  private isInitialized: boolean = false;
  private currentVideoPlayerVolume: number = 1;
  private isAdjustingVolume: boolean = false;
  private videoVolumeWhilePlayingDubbing: number =
    config.videoVolumeWhilePlayingDubbing;

  private constructor() {
    this.precisionTimer = new PrecisionTimer(this.handlePreciseTime);
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = SubtitleManager.getInstance();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.setupMessageListener();
    this.setupVolumeCheck();
    this.setupUnloadListener();
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.movieState) {
        const newMovieState = changes.movieState.newValue;
        if (newMovieState && typeof newMovieState.subtitleOffset === "number") {
          this.subtitleOffset = newMovieState.subtitleOffset * 1000; // Convert to milliseconds
        }
      }
    });
    this.setupPeriodicCleanup();
  }

  public static getInstance(): DubbingManager {
    if (!DubbingManager.instance) {
      DubbingManager.instance = new DubbingManager();
    }
    return DubbingManager.instance;
  }

  public async initialize(
    movieId: string,
    languageCode: string,
    srtContent: string | null | undefined,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<void> {
    console.log("Initializing DubbingManager:", {
      movieId,
      languageCode,
      isInitialized: this.isInitialized,
      hasSrtContent: !!srtContent,
      seasonNumber,
      episodeNumber,
    });

    if (this.isInitialized) {
      console.log("DubbingManager is already initialized. Reinitializing...");
      await this.stop();
    }

    this.currentMovieId = movieId;
    this.currentLanguageCode = languageCode;
    this.currentSeasonNumber = seasonNumber || null;
    this.currentEpisodeNumber = episodeNumber || null;
    this.isDubbingPaused = false;

    try {
      let subtitles: Subtitle[];
      if (srtContent) {
        subtitles = parseSrt(srtContent);
        this.subtitleManager.cacheSubtitles(movieId, languageCode, subtitles);
      } else {
        const fetchedSubtitles = await this.subtitleManager.getSubtitles(
          movieId,
          languageCode
        );
        if (!fetchedSubtitles) {
          return console.error(
            `Failed to fetch subtitles for movie ${movieId} and language ${languageCode}`
          );
        }
        subtitles = fetchedSubtitles;
      }

      console.log("Subtitles loaded:", subtitles.length);
      if (subtitles.length === 0) {
        return console.error(
          `No subtitles found for movie ${movieId} and language ${languageCode}`
        );
      }

      this.findAndStoreVideoElement();
      console.log("Video element found:", !!this.videoElement);

      if (this.videoElement) {
        this.currentVideoPlayerVolume = this.videoElement.volume;
        this.precisionTimer.setVideoElement(this.videoElement);
        this.lastSentSubtitle = null;
        this.lastSentTime = 0;
        this.lastVideoTime = 0;

        this.audioContext = new window.AudioContext();
        this.audioFileManager = new AudioFileManager(this.audioContext);
        this.audioPlayer = new AudioPlayer(this.audioContext);

        await this.startDubbing();
        this.isInitialized = true;
        this.isDubbingPaused = false;
        console.log("DubbingManager initialized successfully");
      } else {
        console.warn("No video element found. Setting up observer.");
        this.setupVideoObserver();
      }
    } catch (error) {
      console.warn("Error during initialization:", error);
      this.isInitialized = false;
      throw error;
    }
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.audioPlayer.clearRecentlyPlayedAudio();
    }, 5000); // Clean up every 5 seconds
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

    this.adjustVolume(this.videoElement);

    this.playCurrentSubtitles(currentVideoTime * 1000);

    this.checkAndGenerateUpcomingAudio(currentVideoTime * 1000);
  }

  public pauseDubbing(): void {
    this.isDubbingPaused = true;
    this.precisionTimer.pause();
    this.audioPlayer.stopAllAudio();

    this.restoreVideoVolume();
  }

  private setupVolumeCheck(): void {
    setInterval(() => {
      if (
        this.videoElement &&
        !this.isAnyDubbingAudioPlaying() &&
        !this.isDubbingPaused &&
        this.currentMovieId &&
        this.currentLanguageCode
      ) {
        this.adjustVolume(this.videoElement);
      }
    }, 1000);
  }

  private async startDubbing(): Promise<void> {
    console.log("Starting dubbing process");
    try {
      const subtitles = await this.subtitleManager.getSubtitles(
        this.currentMovieId!,
        this.currentLanguageCode!
      );
      console.log("Subtitles loaded:", subtitles ? subtitles.length : "none");
      if (subtitles && subtitles.length > 0 && this.videoElement) {
        console.log("Starting precision timer");
        this.precisionTimer.start(this.videoElement.currentTime);
        console.log("Playing current subtitles");
        this.playCurrentSubtitles(this.videoElement.currentTime * 1000);
        console.log("Dubbing started successfully");
      } else {
        return console.error(
          "No subtitles available for dubbing or no video element found"
        );
      }
    } catch (error) {
      console.error("Error starting dubbing:", error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.audioFileManager.stop();
    this.audioFileManager.clearCache();
    this.audioPlayer.stopAllAudio();
    this.subtitleManager.reset();
    this.currentMovieId = null;
    this.currentLanguageCode = null;
    this.isDubbingPaused = true;
    this.lastSentSubtitle = null;
    this.lastSentTime = 0;
    this.precisionTimer.stop();
    this.removeVideoEventListeners();
    this.restoreVideoVolume();
    this.videoElement = null;
    this.isInitialized = false;
    console.log("DubbingManager stopped and reset");
  }

  private restoreVideoVolume(): void {
    if (this.videoElement) {
      this.videoElement.volume = this.currentVideoPlayerVolume;
    }
  }

  public isCurrentDubbing(movieId: string, languageCode: string): boolean {
    return (
      this.currentMovieId === movieId &&
      this.currentLanguageCode === languageCode
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
            if (message.movieId && message.languageCode) {
              this.initialize(
                message.movieId,
                message.languageCode,
                message.srtContent,
                message.seasonNumber,
                message.episodeNumber
              );
              sendResponse({ status: "initialized" });
            } else {
              sendResponse({
                status: "error",
                message: "Missing movieId or languageCode",
              });
            }
            break;
          case "checkDubbingStatus":
            sendResponse({
              isDubbingActive:
                !!this.currentMovieId &&
                !!this.currentLanguageCode &&
                !this.isDubbingPaused,
            });
            break;
          case "updateDubbingState":
            if (message.payload) {
              this.isDubbingPaused = false;
              this.resumeDubbing();
            } else {
              this.pauseDubbing();
            }
            sendResponse({ status: "updated" });
            break;
          case "setDubbingVolumeMultiplier":
            this.setDubbingVolumeMultiplier(message.payload);
            sendResponse({ status: "updated" });
            break;
        }
        return true;
      }
    );
  }

  private handleVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.currentVideoPlayerVolume = video.volume;
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
    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  };

  private handleVideoPause = (): void => {
    if (!this.isDubbingPaused) {
      this.pauseDubbing();
    }
    this.restoreVideoVolume();
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
    const newVolume = video.volume;

    // Check if the volume change is significant (to avoid reacting to minor adjustments)
    if (Math.abs(newVolume - this.currentVideoPlayerVolume) > 0.01) {
      // Check if this is a human change (not caused by our extension)
      if (!this.isAdjustingVolume) {
        this.currentVideoPlayerVolume = newVolume;
        // Don't call adjustVolume here, as it might interfere with user's manual adjustment
      }
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
    console.log("Precise time update:", time);
    if (this.isDubbingPaused) {
      console.log("Dubbing is paused, skipping update");
      return;
    }

    const currentTimeMs = time * 1000;
    const adjustedTimeMs = currentTimeMs - this.subtitleOffset;

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }

    console.log("Playing current subtitles");
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
    if (
      this.currentSeasonNumber !== null &&
      this.currentEpisodeNumber !== null
    ) {
      // TV series
      return `${this.currentMovieId}/${this.currentSeasonNumber}/${this.currentEpisodeNumber}/${this.currentLanguageCode}/${subtitle.start}-${subtitle.end}.mp3`;
    } else {
      // Movie
      return `${this.currentMovieId}/${this.currentLanguageCode}/${subtitle.start}-${subtitle.end}.mp3`;
    }
  }

  setDubbingVolumeMultiplier(multiplier: number): void {
    this.audioPlayer.setDubbingVolumeMultiplier(multiplier);
  }

  public setVideoVolumeWhilePlayingDubbing(volume: number): void {
    this.videoVolumeWhilePlayingDubbing = volume;
    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  }

  private adjustVolume(video: HTMLVideoElement | null): void {
    if (!video) return;

    this.isAdjustingVolume = true;
    const isDubbingPlaying = this.isAnyDubbingAudioPlaying();

    if (isDubbingPlaying) {
      // Use the class property instead of config
      video.volume =
        this.currentVideoPlayerVolume * this.videoVolumeWhilePlayingDubbing;
    } else {
      video.volume = this.currentVideoPlayerVolume;
    }

    console.log(
      `Adjusting volume: Video ${video.volume}, isDubbingPlaying: ${isDubbingPlaying}, CurrentVolume: ${this.currentVideoPlayerVolume}, VVWPD: ${this.videoVolumeWhilePlayingDubbing}`
    );

    setTimeout(() => {
      this.isAdjustingVolume = false;
    }, 50);
  }

  private setupUnloadListener(): void {
    window.addEventListener("beforeunload", this.handlePageUnload);
  }

  private handlePageUnload = (): void => {
    this.restoreVideoVolume();
  };

  private isAnyDubbingAudioPlaying(): boolean {
    return this.audioPlayer.getCurrentlyPlayingSubtitles().length > 0;
  }

  private playCurrentSubtitles(currentTimeMs: number): void {
    console.log("Playing current subtitles at time:", currentTimeMs);
    const adjustedTimeMs = currentTimeMs - this.subtitleOffset;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);
    console.log("Current subtitles:", currentSubtitles);

    for (const subtitle of currentSubtitles) {
      const audioFilePath = this.getAudioFilePath(subtitle);
      const startTimeMs = subtitle.start;

      if (
        adjustedTimeMs >= startTimeMs &&
        adjustedTimeMs < subtitle.end &&
        !this.audioPlayer.isAudioActive(audioFilePath)
      ) {
        console.log("Playing audio for subtitle:", subtitle.text);
        const audioOffsetMs = Math.max(0, adjustedTimeMs - startTimeMs);
        this.playAudioIfAvailable(subtitle, audioOffsetMs / 1000);

        // Adjust volume after starting to play a new subtitle
        if (this.videoElement) {
          this.adjustVolume(this.videoElement);
        }
      }
    }
  }

  private async playAudioIfAvailable(
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const filePath = this.getAudioFilePath(subtitle);
    try {
      // First, check if the audio file exists or is being generated
      const exists = await this.audioFileManager.checkFileExists(filePath);
      if (!exists) {
        // If not, trigger generation
        await this.audioFileManager.generateAudio(filePath, subtitle.text);
      }

      // Now try to get the audio buffer
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
