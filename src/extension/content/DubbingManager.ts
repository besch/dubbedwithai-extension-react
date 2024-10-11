import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { DubbingMessage, DubbingVoice, Subtitle } from "@/types";
import config from "./config";
import { parseSrt } from "../utils";
import { VideoManager } from "./VideoManager";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

type DubbingManagerState = {
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
  originalVideoVolume: number;
};

export class DubbingManager {
  private static instance: DubbingManager | null = null;
  private audioFileManager: AudioFileManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private audioContext: AudioContext;
  private videoManager: VideoManager;

  private currentState: {
    movieId: string | null;
    languageCode: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    dubbingVoice: DubbingVoice;
    subtitleOffset: number; // in milliseconds
    isDubbingActive: boolean;
    lastSentSubtitle: Subtitle | null;
    lastSentTime: number; // in milliseconds
    lastVideoTime: number; // in milliseconds
    currentVideoPlayerVolume: number;
    videoVolumeWhilePlayingDubbing: number;
    originalVideoVolume: number;
  };

  private constructor() {
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = SubtitleManager.getInstance();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.videoManager = new VideoManager(this);

    window.addEventListener("message", this.handleMessage.bind(this));

    this.currentState = {
      movieId: null,
      languageCode: null,
      seasonNumber: null,
      episodeNumber: null,
      dubbingVoice: "echo",
      subtitleOffset: 0,
      isDubbingActive: false,
      lastSentSubtitle: null,
      lastSentTime: 0,
      lastVideoTime: 0,
      currentVideoPlayerVolume: 1,
      videoVolumeWhilePlayingDubbing: config.videoVolumeWhilePlayingDubbing,
      originalVideoVolume: 1,
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
      return;
    }
    const isDubbingActive = await this.isDubbingActiveInAnyFrame();
    if (isDubbingActive) {
      return;
    }

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

      await this.videoManager.findAndStoreVideoElement();
      if (this.videoManager.getVideoElement()) {
        this.setupAudioContext();
        this.startDubbing();
        this.updateCurrentState({
          isDubbingActive: true,
        });
      }

      if (
        this.videoManager.getVideoElement() &&
        !this.videoManager.getVideoElement()!.paused
      ) {
        this.videoManager["handleVideoPlay"](); // invoking private method
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
    if (this.videoManager.getVideoElement()) {
      this.updateCurrentState({
        currentVideoPlayerVolume: this.videoManager.getVideoElement()!.volume,
      });
      this.audioContext = new window.AudioContext();
      this.audioFileManager = new AudioFileManager(this.audioContext);
      this.audioPlayer = new AudioPlayer(this.audioContext);
    }
  }

  private stopDubbing(): void {
    this.updateCurrentState({ isDubbingActive: false });
    this.audioPlayer.pauseAllAudio();
    this.videoManager.restoreOriginalVideoVolume();

    chrome.runtime.sendMessage({
      action: "updateDubbingState",
      payload: false,
    });
  }

  private startDubbing(): void {
    if (this.videoManager.getVideoElement()) {
      this.updateCurrentState({
        isDubbingActive: true,
        originalVideoVolume: this.videoManager.getVideoElement()!.volume,
      });
    } else {
      return this.updateCurrentState({
        isDubbingActive: true,
      });
    }
    this.audioContext.resume();

    const currentVideoTimeMs = this.videoManager.getCurrentVideoTimeMs();
    this.updateCurrentState({ lastVideoTime: currentVideoTimeMs });
    this.videoManager.adjustVolume(this.videoManager.getVideoElement());

    chrome.runtime.sendMessage({
      action: "updateDubbingState",
      payload: true,
    });
  }

  public updateCurrentState(newState: Partial<DubbingManagerState>): void {
    this.currentState = { ...this.currentState, ...newState };
  }

  private setupEventListeners(): void {
    this.setupStorageListener();
    this.setupMessageListener();
    this.videoManager.setupUnloadListener();
  }

  private setupStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.movieState) {
        const newMovieState = changes.movieState.newValue;
        if (newMovieState && typeof newMovieState.subtitleOffset === "number") {
          this.updateCurrentState({
            subtitleOffset: newMovieState.subtitleOffset,
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
    this.videoManager.removeVideoEventListeners();
    this.videoManager.restoreOriginalVideoVolume();

    this.updateCurrentState({
      movieId: null,
      languageCode: null,
      isDubbingActive: false,
      lastSentSubtitle: null,
      lastSentTime: 0,
    });
  }

  public isCurrentDubbing(movieId: string, languageCode: string): boolean {
    return (
      this.currentState.movieId === movieId &&
      this.currentState.languageCode === languageCode
    );
  }

  public async isDubbingActiveInAnyFrame(): Promise<boolean> {
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

  public notifyBackgroundScript(isPlaying: boolean): void {
    chrome.runtime.sendMessage({
      action: "updateVideoPlaybackState",
      isPlaying: isPlaying,
      isDubbingActive: this.currentState.isDubbingActive,
    });
  }

  public setDubbingVolumeMultiplier(multiplier: number): void {
    this.audioPlayer.setDubbingVolumeMultiplier(multiplier);
  }

  public setVideoVolumeWhilePlayingDubbing(volume: number): void {
    this.updateCurrentState({ videoVolumeWhilePlayingDubbing: volume });
    if (this.videoManager.getVideoElement()) {
      this.videoManager.adjustVolume(this.videoManager.getVideoElement());
    }
  }

  public isAnyDubbingAudioPlaying(): boolean {
    return this.audioPlayer.getCurrentlyPlayingSubtitles().length > 0;
  }

  public playCurrentSubtitles(currentTimeMs: number): void {
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

    if (this.videoManager.getVideoElement()) {
      this.videoManager.adjustVolume(this.videoManager.getVideoElement());
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
      const audioOffsetSeconds = Math.max(
        0,
        (adjustedTimeMs - startTimeMs) / 1000
      );
      this.playAudioIfAvailable(subtitle, audioOffsetSeconds);
    }
  }

  private async playAudioIfAvailable(
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const filePath = this.getAudioFilePath(subtitle);
    const buffer = await this.audioFileManager.getAudioBuffer(filePath);
    if (buffer) {
      await this.audioPlayer.playAudio(buffer, filePath, subtitle, offset);
    }
  }

  public sendCurrentSubtitleInfo(
    adjustedTimeMs: number,
    currentSubtitles: Subtitle[]
  ): void {
    if (currentSubtitles.length > 0) {
      const currentSubtitle = currentSubtitles[0];
      const startTimeSeconds = currentSubtitle.start / 1000;
      const endTimeSeconds = currentSubtitle.end / 1000;

      if (
        currentSubtitle !== this.currentState.lastSentSubtitle ||
        adjustedTimeMs - this.currentState.lastSentTime >=
          config.subtitleUpdateInterval * 1000
      ) {
        chrome.runtime.sendMessage({
          action: "currentSubtitle",
          subtitle: {
            text: currentSubtitle.text,
            start: startTimeSeconds,
            end: endTimeSeconds,
            currentTime: adjustedTimeMs / 1000,
          },
        });

        this.updateCurrentState({
          lastSentSubtitle: currentSubtitle,
          lastSentTime: adjustedTimeMs,
        });
      }
    } else if (this.currentState.lastSentSubtitle !== null) {
      chrome.runtime.sendMessage({ action: "currentSubtitle", subtitle: null });
      this.updateCurrentState({ lastSentSubtitle: null });
    }
  }

  public setDubbingVoice(voice: DubbingVoice): void {
    this.updateCurrentState({ dubbingVoice: voice });
  }

  public getSubtitleOffset(): number {
    return this.currentState.subtitleOffset;
  }

  public getLastVideoTime(): number {
    return this.currentState.lastVideoTime;
  }

  public getVideoVolumeWhilePlayingDubbing(): number {
    return this.currentState.videoVolumeWhilePlayingDubbing;
  }

  public getAudioPlayer(): AudioPlayer {
    return this.audioPlayer;
  }

  public checkAndGenerateUpcomingAudio(currentTimeMs: number): void {
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
        (async () => {
          try {
            const audioBuffer = await this.audioFileManager.fetchAudioFile(
              filePath
            );
            if (audioBuffer) {
              // Cache the audio buffer for later use
              await this.audioFileManager.cacheAudioBuffer(
                filePath,
                audioBuffer
              );
            } else {
              // If audio file not found, generate it
              await this.audioFileManager.generateAudio(
                filePath,
                subtitle.text
              );
            }
          } catch (error) {
            console.error(
              `Error fetching or generating audio for ${filePath}:`,
              error
            );
          }
        })();
      }
    }
  }

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
              isDubbingActive: this.currentState.isDubbingActive,
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

  public hasVideoElement(): boolean {
    return this.videoManager.hasVideoElement();
  }

  public get isDubbingActive(): boolean {
    return this.currentState.isDubbingActive;
  }
}
