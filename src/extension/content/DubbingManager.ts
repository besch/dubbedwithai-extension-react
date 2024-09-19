import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { PrecisionTimer } from "./PrecisionTimer";
import { DubbingMessage, DubbingVoice, Subtitle } from "@/types";
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
    dubbingVoice: DubbingVoice;
    subtitleOffset: number;
    isDubbingActive: boolean;
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
    window.addEventListener("message", this.handleMessage.bind(this));

    this.currentState = {
      movieId: null,
      languageCode: null,
      seasonNumber: null,
      episodeNumber: null,
      dubbingVoice: "alloy",
      subtitleOffset: 0,
      isDubbingActive: false,
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
    movieId: string | null,
    languageCode: string | null,
    srtContent: string,
    seasonNumber?: number,
    episodeNumber?: number
  ): Promise<void> {
    if (!srtContent) {
      throw new Error("No subtitles");
    }
    const isDubbingActive = await this.isDubbingActiveInAnyFrame();
    if (isDubbingActive) {
      return;
    }

    console.log("Initializing DubbingManager:", {
      movieId,
      languageCode,
      hasSrtContent: !!srtContent,
      seasonNumber,
      episodeNumber,
    });

    if (this.currentState.isDubbingActive) {
      console.log(
        "DubbingManager is already active. Stopping current dubbing..."
      );
      await this.stop();
    }

    this.updateCurrentState({
      movieId,
      languageCode,
      seasonNumber: seasonNumber || null,
      episodeNumber: episodeNumber || null,
      isDubbingActive: false,
    });

    try {
      const subtitles = parseSrt(srtContent);

      if (subtitles.length === 0) {
        throw new Error(
          `No subtitles found for movie ${movieId}, language ${languageCode}, season ${seasonNumber}, episode ${episodeNumber}`
        );
      }

      this.subtitleManager.setActiveSubtitles(subtitles);

      await this.findAndStoreVideoElement();
      if (this.videoElement) {
        this.setupAudioContext();
        this.startDubbing();
        this.updateCurrentState({
          isDubbingActive: true,
        });
      } else {
        this.setupVideoObserver();
      }

      if (this.videoElement && !this.videoElement.paused) {
        this.handleVideoPlay();
      }
    } catch (error) {
      this.updateCurrentState({ isDubbingActive: false });
      throw error;
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (event.data.type === "CHECK_DUBBING_ACTIVE") {
      (event.source as Window)?.postMessage(
        {
          type: "DUBBING_ACTIVE_STATUS",
          isActive: this.currentState.isDubbingActive,
        },
        { targetOrigin: event.origin }
      );
    } else if (event.data.type === "SET_DUBBING_ACTIVE") {
      this.updateCurrentState({ isDubbingActive: true });
    } else if (event.data.type === "DUBBING_ACTIVE_STATUS") {
      if (event.data.isActive) {
        this.updateCurrentState({ isDubbingActive: false });
      }
    }
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

  private stopDubbing(): void {
    this.updateCurrentState({ isDubbingActive: false });
    this.precisionTimer.pause();
    this.audioPlayer.pauseAllAudio();
    this.restoreVideoVolume();

    chrome.runtime.sendMessage({
      action: "updateDubbingState",
      payload: false,
    });
  }

  private startDubbing(): void {
    this.updateCurrentState({ isDubbingActive: true });
    this.audioContext.resume();

    if (!this.videoElement) {
      console.error("No video element found");
      return;
    }

    const currentVideoTime = this.videoElement.currentTime;
    this.precisionTimer.start(currentVideoTime);
    this.adjustVolume(this.videoElement);

    chrome.runtime.sendMessage({
      action: "updateDubbingState",
      payload: true,
    });
  }

  private setupVolumeCheck(): void {
    setInterval(() => {
      if (
        this.videoElement &&
        !this.isAnyDubbingAudioPlaying() &&
        !this.currentState.isDubbingActive &&
        this.currentState.movieId &&
        this.currentState.languageCode
      ) {
        this.adjustVolume(this.videoElement);
      }
    }, 1000);
  }

  private updateCurrentState(
    newState: Partial<typeof this.currentState>
  ): void {
    this.currentState = { ...this.currentState, ...newState };
  }

  private setupEventListeners(): void {
    this.setupStorageListener();
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
    this.audioPlayer.pauseAllAudio();
    this.subtitleManager.reset();
    this.precisionTimer.stop();
    this.removeVideoEventListeners();
    this.restoreVideoVolume();

    this.updateCurrentState({
      movieId: null,
      languageCode: null,
      isDubbingActive: false,
      lastSentSubtitle: null,
      lastSentTime: 0,
    });

    this.videoElement = null;
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

  public async findAndStoreVideoElement(): Promise<void> {
    const isDubbingActive = await this.isDubbingActiveInAnyFrame();
    if (isDubbingActive) {
      return;
    }

    this.videoElement = document.querySelector("video");

    if (this.videoElement) {
      this.handleVideo(this.videoElement);
      this.setDubbingActiveFlag();
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
            this.setDubbingActiveFlag();
            return;
          }
        }
      } catch (e) {
        console.error("Could not access iframe content:", e);
      }
    }

    this.setupVideoObserver();
  }

  private isDubbingActiveInAnyFrame(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkDubbingActive = (event: MessageEvent) => {
        if (event.data.type === "DUBBING_ACTIVE_STATUS") {
          window.removeEventListener("message", checkDubbingActive);
          resolve(event.data.isActive);
        }
      };

      window.addEventListener("message", checkDubbingActive);
      window.top?.postMessage({ type: "CHECK_DUBBING_ACTIVE" }, "*");

      setTimeout(() => {
        window.removeEventListener("message", checkDubbingActive);
        resolve(false);
      }, 1000);
    });
  }

  private setDubbingActiveFlag(): void {
    window.top?.postMessage({ type: "SET_DUBBING_ACTIVE" }, "*");
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
        if (this.isUploadedSubtitle(filePath)) {
          // For uploaded subtitles, generate audio without checking existence
          await this.audioFileManager.generateAudio(filePath, subtitle.text);
        } else {
          // For regular subtitles, check existence before generating
          const exists = await this.audioFileManager.checkFileExists(filePath);
          if (!exists) {
            await this.audioFileManager.generateAudio(filePath, subtitle.text);
          }
        }
      }
    }
  }

  private isUploadedSubtitle(filePath: string): boolean {
    return filePath.includes("uploaded");
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (message: DubbingMessage, sender, sendResponse) => {
        switch (message.action) {
          case "initializeDubbing":
            this.initialize(
              message.movieId,
              message.languageCode,
              message.srtContent,
              message.seasonNumber,
              message.episodeNumber
            );
            sendResponse({ status: "initialized" });
            break;
          case "checkDubbingStatus":
            sendResponse({
              isDubbingActive:
                !!this.currentState.movieId &&
                !!this.currentState.languageCode &&
                this.currentState.isDubbingActive,
            });
            break;
          case "updateDubbingState":
            if (message.payload) {
              this.startDubbing();
            } else {
              this.stopDubbing();
            }
            sendResponse({ status: "updated" });
            break;
          case "setDubbingVolumeMultiplier":
            this.setDubbingVolumeMultiplier(message.payload);
            sendResponse({ status: "updated" });
            break;
          case "setDubbingVoice":
            this.setDubbingVoice(message.payload);
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
    this.removeVideoEventListeners();
    video.addEventListener("play", this.handleVideoPlay);
    video.addEventListener("pause", this.handleVideoPause);
    video.addEventListener("seeking", this.handleVideoSeeking);
    video.addEventListener("volumechange", this.handleVolumeChange);
    video.addEventListener("timeupdate", this.handleTimeUpdate);
  }

  private handleVideoPlay = (): void => {
    const currentTime = this.videoElement?.currentTime || 0;

    if (this.currentState.isDubbingActive) {
      this.precisionTimer.start(currentTime);
      this.playCurrentSubtitles(currentTime * 1000);
      this.notifyBackgroundScript(true);
    }

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  };

  private handleVideoPause = (): void => {
    if (this.currentState.isDubbingActive) {
      this.precisionTimer.pause();
      this.audioPlayer.pauseAllAudio();
      this.notifyBackgroundScript(false);
    }
    this.restoreVideoVolume();
  };

  private notifyBackgroundScript(isPlaying: boolean): void {
    chrome.runtime.sendMessage({
      action: "updateVideoPlaybackState",
      isPlaying: isPlaying,
      isDubbingActive: this.currentState.isDubbingActive,
    });
  }

  private handleVideoSeeking = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const newTime = video.currentTime;

    this.precisionTimer.stop();
    this.audioPlayer.pauseAllAudio();
    this.precisionTimer.start(newTime);

    if (this.currentState.isDubbingActive) {
      this.playCurrentSubtitles(newTime * 1000);
      this.notifyBackgroundScript(true);
    }
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
    if (!this.currentState.isDubbingActive) {
      return;
    }

    const currentTimeMs = time * 1000;
    const adjustedTimeMs = currentTimeMs - this.currentState.subtitleOffset;

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }

    this.playCurrentSubtitles(currentTimeMs);
    this.audioPlayer.fadeOutExpiredAudio(adjustedTimeMs);
    this.sendCurrentSubtitleInfo(
      adjustedTimeMs,
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs)
    );
    this.checkAndGenerateUpcomingAudio(currentTimeMs);
  };

  private getAudioFilePath(subtitle: Subtitle): string {
    if (this.currentState.movieId === null) {
      return `uploaded/${this.currentState.dubbingVoice}/${subtitle.start}-${subtitle.end}.mp3`;
    } else if (
      this.currentState.seasonNumber !== null &&
      this.currentState.episodeNumber !== null
    ) {
      // TV series
      return `${this.currentState.movieId}/${this.currentState.seasonNumber}/${this.currentState.episodeNumber}/${this.currentState.languageCode}/${this.currentState.dubbingVoice}/${subtitle.start}-${subtitle.end}.mp3`;
    } else {
      // Movie
      return `${this.currentState.movieId}/${this.currentState.languageCode}/${this.currentState.dubbingVoice}/${subtitle.start}-${subtitle.end}.mp3`;
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
    const adjustedTimeMs = currentTimeMs - this.currentState.subtitleOffset;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);

    if (currentSubtitles.length === 0) {
      const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
        adjustedTimeMs,
        config.preloadAudioTime
      );
      if (upcomingSubtitles.length > 0) {
        this.prepareAndPlaySubtitle(upcomingSubtitles[0], adjustedTimeMs);
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

  public hasVideoElement(): boolean {
    return !!this.videoElement;
  }

  public setDubbingVoice(voice: DubbingVoice): void {
    this.updateCurrentState({ dubbingVoice: voice });
  }
}
