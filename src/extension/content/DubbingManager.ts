import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { PrecisionTimer } from "./PrecisionTimer";
import { DubbingMessage, Subtitle } from "@/types";
import config from "./config";
import { parseSrt } from "../utils";

export class DubbingManager {
  private static instance: DubbingManager | null = null;
  private audioFileManager: AudioFileManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private audioContext: AudioContext;
  private precisionTimer: PrecisionTimer;
  private videoElement: HTMLVideoElement | null = null;
  private isAdjustingVolume: boolean = false;

  private currentState: {
    movieId: string | null;
    languageCode: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    subtitleOffset: number;
    isDubbingPaused: boolean;
    isInitialized: boolean;
    lastSentSubtitle: Subtitle | null;
    lastSentTime: number;
    lastVideoTime: number;
    currentVideoPlayerVolume: number;
    videoVolumeWhilePlayingDubbing: number;
  };

  private constructor() {
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = SubtitleManager.getInstance();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.precisionTimer = new PrecisionTimer(this.handlePreciseTime);

    this.currentState = {
      movieId: null,
      languageCode: null,
      seasonNumber: null,
      episodeNumber: null,
      subtitleOffset: 0,
      isDubbingPaused: false,
      isInitialized: false,
      lastSentSubtitle: null,
      lastSentTime: 0,
      lastVideoTime: 0,
      currentVideoPlayerVolume: 1,
      videoVolumeWhilePlayingDubbing: config.videoVolumeWhilePlayingDubbing,
    };

    this.setupEventListeners();
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
      isInitialized: this.currentState.isInitialized,
      hasSrtContent: !!srtContent,
      seasonNumber,
      episodeNumber,
    });

    if (this.currentState.isInitialized) {
      console.log("DubbingManager is already initialized. Reinitializing...");
      await this.stop();
    }

    this.updateCurrentState({
      movieId,
      languageCode,
      seasonNumber: seasonNumber || null,
      episodeNumber: episodeNumber || null,
      isDubbingPaused: false,
    });

    try {
      const subtitles = await this.loadSubtitles(
        movieId,
        languageCode,
        srtContent,
        seasonNumber,
        episodeNumber
      );
      if (subtitles.length === 0) {
        throw new Error(
          `No subtitles found for movie ${movieId}, language ${languageCode}, season ${seasonNumber}, episode ${episodeNumber}`
        );
      }

      this.findAndStoreVideoElement();
      if (this.videoElement) {
        this.setupAudioContext();
        await this.startDubbing();
        this.updateCurrentState({
          isInitialized: true,
          isDubbingPaused: false,
        });
        console.log("DubbingManager initialized successfully");
      } else {
        console.warn("No video element found. Setting up observer.");
        this.setupVideoObserver();
      }
    } catch (error) {
      console.warn("Error during initialization:", error);
      this.updateCurrentState({ isInitialized: false });
      throw error;
    }
  }

  private async loadSubtitles(
    movieId: string,
    languageCode: string,
    srtContent: string | null | undefined,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<Subtitle[]> {
    let subtitles: Subtitle[];
    if (srtContent) {
      subtitles = parseSrt(srtContent);
      this.subtitleManager.cacheSubtitles(
        movieId,
        languageCode,
        subtitles,
        seasonNumber,
        episodeNumber
      );
    } else {
      const fetchedSubtitles = await this.subtitleManager.getSubtitles(
        movieId,
        languageCode,
        seasonNumber,
        episodeNumber
      );
      if (!fetchedSubtitles) {
        throw new Error(
          `Failed to fetch subtitles for movie ${movieId}, language ${languageCode}, season ${seasonNumber}, episode ${episodeNumber}`
        );
      }
      subtitles = fetchedSubtitles;
    }
    console.log("Subtitles loaded:", subtitles.length);
    return subtitles;
  }

  private setupAudioContext(): void {
    this.updateCurrentState({
      currentVideoPlayerVolume: this.videoElement!.volume,
    });
    this.precisionTimer.setVideoElement(this.videoElement!);
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.audioPlayer = new AudioPlayer(this.audioContext);
  }

  private setupPeriodicCleanup(): void {
    setInterval(() => {
      this.audioPlayer.clearRecentlyPlayedAudio();
    }, 5000); // Clean up every 5 seconds
  }

  public resumeDubbing(): void {
    if (!this.currentState.isDubbingPaused) {
      return;
    }

    this.updateCurrentState({ isDubbingPaused: false });
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
    this.updateCurrentState({ isDubbingPaused: true });
    this.precisionTimer.pause();
    this.audioPlayer.stopAllAudio();
    this.restoreVideoVolume();
  }

  private setupVolumeCheck(): void {
    setInterval(() => {
      if (
        this.videoElement &&
        !this.isAnyDubbingAudioPlaying() &&
        !this.currentState.isDubbingPaused &&
        this.currentState.movieId &&
        this.currentState.languageCode
      ) {
        this.adjustVolume(this.videoElement);
      }
    }, 1000);
  }

  private async startDubbing(): Promise<void> {
    console.log("Starting dubbing process");
    const subtitles = await this.subtitleManager.getSubtitles(
      this.currentState.movieId!,
      this.currentState.languageCode!
    );
    if (subtitles && subtitles.length > 0 && this.videoElement) {
      console.log("Starting precision timer");
      this.precisionTimer.start(this.videoElement.currentTime);
      console.log("Playing current subtitles");
      this.playCurrentSubtitles(this.videoElement.currentTime * 1000);
      console.log("Dubbing started successfully");
    } else {
      throw new Error(
        "No subtitles available for dubbing or no video element found"
      );
    }
  }

  private updateCurrentState(
    newState: Partial<typeof this.currentState>
  ): void {
    this.currentState = { ...this.currentState, ...newState };
  }

  private setupEventListeners(): void {
    this.setupStorageListener();
    this.setupPeriodicCleanup();
    this.setupMessageListener();
    this.setupVolumeCheck();
    this.setupUnloadListener();
  }

  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.movieState) {
        const newMovieState = changes.movieState.newValue;
        if (newMovieState && typeof newMovieState.subtitleOffset === "number") {
          this.updateCurrentState({
            subtitleOffset: newMovieState.subtitleOffset * 1000,
          });
        }
      }
    });
  }

  public async stop(): Promise<void> {
    this.audioFileManager.stop();
    this.audioFileManager.clearCache();
    this.audioPlayer.stopAllAudio();
    this.subtitleManager.reset();
    this.precisionTimer.stop();
    this.removeVideoEventListeners();
    this.restoreVideoVolume();

    this.updateCurrentState({
      movieId: null,
      languageCode: null,
      isDubbingPaused: true,
      lastSentSubtitle: null,
      lastSentTime: 0,
      isInitialized: false,
    });

    this.videoElement = null;
    console.log("DubbingManager stopped and reset");
  }

  private restoreVideoVolume(): void {
    if (this.videoElement) {
      this.videoElement.volume = this.currentState.currentVideoPlayerVolume;
    }
  }

  public isCurrentDubbing(movieId: string, languageCode: string): boolean {
    return (
      this.currentState.movieId === movieId &&
      this.currentState.languageCode === languageCode
    );
  }

  private findAndStoreVideoElement(): void {
    this.videoElement = document.querySelector("video");

    if (this.videoElement) {
      this.handleVideo(this.videoElement);
      return;
    }

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
                !!this.currentState.movieId &&
                !!this.currentState.languageCode &&
                !this.currentState.isDubbingPaused,
            });
            break;
          case "updateDubbingState":
            if (message.payload) {
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
    this.updateCurrentState({ currentVideoPlayerVolume: video.volume });
    video.addEventListener("play", this.handleVideoPlay);
    video.addEventListener("pause", this.handleVideoPause);
    video.addEventListener("seeking", this.handleVideoSeeking);
    video.addEventListener("volumechange", this.handleVolumeChange);
    video.addEventListener("timeupdate", this.handleTimeUpdate);
  }

  private handleVideoPlay = (): void => {
    if (!this.currentState.isDubbingPaused) {
      this.resumeDubbing();
    }
    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  };

  private handleVideoPause = (): void => {
    if (!this.currentState.isDubbingPaused) {
      this.pauseDubbing();
    }
    this.restoreVideoVolume();
  };

  private handleVideoSeeking = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const newTime = video.currentTime;

    this.precisionTimer.stop();
    this.audioPlayer.stopAllAudio();
    this.precisionTimer.start(newTime);

    if (!this.currentState.isDubbingPaused) {
      this.playCurrentSubtitles(newTime * 1000);
    }

    this.checkAndGenerateUpcomingAudio(newTime * 1000);
  };

  private handleVolumeChange = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const newVolume = video.volume;

    if (
      Math.abs(newVolume - this.currentState.currentVideoPlayerVolume) > 0.01
    ) {
      if (!this.isAdjustingVolume) {
        this.updateCurrentState({ currentVideoPlayerVolume: newVolume });
      }
    }
  };

  private handleTimeUpdate = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const currentTime = video.currentTime;

    if (Math.abs(currentTime - this.currentState.lastVideoTime) >= 1) {
      this.updateCurrentState({ lastVideoTime: currentTime });
      this.precisionTimer.start(currentTime);
    }
  };

  private handlePreciseTime = (time: number): void => {
    console.log("Precise time update:", time);
    if (this.currentState.isDubbingPaused) {
      console.log("Dubbing is paused, skipping update");
      return;
    }

    const currentTimeMs = time * 1000;
    const adjustedTimeMs = currentTimeMs - this.currentState.subtitleOffset;

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
    const adjustedTime = currentTime - this.currentState.subtitleOffset;
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
      this.currentState.seasonNumber !== null &&
      this.currentState.episodeNumber !== null
    ) {
      // TV series
      return `${this.currentState.movieId}/${this.currentState.seasonNumber}/${this.currentState.episodeNumber}/${this.currentState.languageCode}/${subtitle.start}-${subtitle.end}.mp3`;
    } else {
      // Movie
      return `${this.currentState.movieId}/${this.currentState.languageCode}/${subtitle.start}-${subtitle.end}.mp3`;
    }
  }

  public setDubbingVolumeMultiplier(multiplier: number): void {
    this.audioPlayer.setDubbingVolumeMultiplier(multiplier);
  }

  public setVideoVolumeWhilePlayingDubbing(volume: number): void {
    this.updateCurrentState({ videoVolumeWhilePlayingDubbing: volume });
    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  }

  private adjustVolume(video: HTMLVideoElement | null): void {
    if (!video) return;

    this.isAdjustingVolume = true;
    const isDubbingPlaying = this.isAnyDubbingAudioPlaying();

    if (isDubbingPlaying) {
      video.volume =
        this.currentState.currentVideoPlayerVolume *
        this.currentState.videoVolumeWhilePlayingDubbing;
    } else {
      video.volume = this.currentState.currentVideoPlayerVolume;
    }

    console.log(
      `Adjusting volume: Video ${video.volume}, isDubbingPlaying: ${isDubbingPlaying}, CurrentVolume: ${this.currentState.currentVideoPlayerVolume}, VVWPD: ${this.currentState.videoVolumeWhilePlayingDubbing}`
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
    const adjustedTimeMs = currentTimeMs - this.currentState.subtitleOffset;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);
    console.log("Current subtitles:", currentSubtitles);

    if (currentSubtitles.length === 0) {
      const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
        adjustedTimeMs,
        config.preloadAudioTime
      );
      if (upcomingSubtitles.length > 0) {
        this.prepareAndPlaySubtitle(upcomingSubtitles[0], adjustedTimeMs);
      } else {
        console.log("No upcoming subtitles found.");
      }
    } else {
      for (const subtitle of currentSubtitles) {
        this.prepareAndPlaySubtitle(subtitle, adjustedTimeMs);
      }
    }

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  }

  private prepareAndPlaySubtitle(
    subtitle: Subtitle,
    adjustedTimeMs: number
  ): void {
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
  }

  private async playAudioIfAvailable(
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const filePath = this.getAudioFilePath(subtitle);
    try {
      const exists = await this.audioFileManager.checkFileExists(filePath);
      if (!exists) {
        await this.audioFileManager.generateAudio(filePath, subtitle.text);
      }

      const buffer = await this.audioFileManager.getAudioBuffer(filePath);
      if (buffer) {
        await this.audioPlayer.playAudio(buffer, filePath, subtitle, offset);
      } else {
        console.warn(`Audio buffer not available for file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error playing audio for file: ${filePath}`, error);
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
        currentSubtitle !== this.currentState.lastSentSubtitle ||
        adjustedTime - this.currentState.lastSentTime >=
          config.subtitleUpdateInterval * 1000
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

        this.updateCurrentState({
          lastSentSubtitle: currentSubtitle,
          lastSentTime: adjustedTime,
        });
      }
    } else if (this.currentState.lastSentSubtitle !== null) {
      chrome.runtime.sendMessage({ action: "currentSubtitle", subtitle: null });
      this.updateCurrentState({ lastSentSubtitle: null });
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
