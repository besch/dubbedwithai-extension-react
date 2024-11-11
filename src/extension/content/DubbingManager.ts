import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { DubbingMessage, DubbingVoice, Subtitle } from "@/types";
import config from "./config";
import { VideoManager } from "./VideoManager";
import { parseSrt } from "../utils";

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

  private isMainContentScript: boolean = false;

  constructor() {
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.videoManager = new VideoManager(this);

    window.addEventListener("message", this.handleMessage.bind(this));

    this.currentState = {
      movieId: null,
      languageCode: null,
      seasonNumber: null,
      episodeNumber: null,
      dubbingVoice: config.defaultVoice,
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

      const videoElement = this.videoManager.getVideoElement();
      if (!videoElement) {
        await this.videoManager.findAndStoreVideoElement();
      }

      if (this.videoManager.getVideoElement()) {
        this.isMainContentScript = true;
        this.notifyVideoElementFound();
        await this.loadSettingsFromStorage();
        await this.startDubbing();
        this.updateCurrentState({
          isDubbingActive: true,
          currentVideoPlayerVolume: this.videoManager.getVideoElement()!.volume,
        });

        if (!this.videoManager.getVideoElement()!.paused) {
          this.videoManager.handleVideoPlay();
        }
      }
    } catch (error) {
      this.updateCurrentState({ isDubbingActive: false });
      throw error;
    }
  }

  private async loadSettingsFromStorage(): Promise<void> {
    const storage = await chrome.storage.local.get(["movieState"]);
    console.log("storage", storage);
    if (storage.movieState) {
      const {
        dubbingVolumeMultiplier,
        videoVolumeWhilePlayingDubbing,
        dubbingVoice,
      } = storage.movieState;
      this.applySettingsChanges({
        subtitleOffset: this.currentState.subtitleOffset / 1000, // Convert back to seconds
        dubbingVolumeMultiplier: dubbingVolumeMultiplier || 1.0,
        videoVolumeWhilePlayingDubbing:
          videoVolumeWhilePlayingDubbing ||
          config.videoVolumeWhilePlayingDubbing,
        dubbingVoice: dubbingVoice || config.defaultVoice,
      });
    }
  }

  private notifyVideoElementFound(): void {
    window.top?.postMessage({ type: "VIDEO_ELEMENT_FOUND" }, "*");
  }

  private handleMessage(event: MessageEvent): void {
    if (event.data.type === "VIDEO_ELEMENT_FOUND" && event.source !== window) {
      this.isMainContentScript = false;
      this.updateCurrentState({ isDubbingActive: false });
    }

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
      if (event.data.isActive && event.source !== window) {
        this.updateCurrentState({ isDubbingActive: false });
      }
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

  private async startDubbing(): Promise<void> {
    const videoElement = this.videoManager.getVideoElement();
    if (!videoElement) {
      throw new Error("No video element found when starting dubbing");
    }

    this.updateCurrentState({
      isDubbingActive: true,
      originalVideoVolume: videoElement.volume,
    });

    await this.audioContext.resume();

    const currentVideoTimeMs = this.videoManager.getCurrentVideoTimeMs();
    this.updateCurrentState({ lastVideoTime: currentVideoTimeMs });
    this.videoManager.adjustVolume(videoElement);

    await this.resumeAudioFromTime(currentVideoTimeMs);

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

    window.addEventListener("message", this.handleMessage.bind(this));
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

    this.videoManager.restoreOriginalVideoVolume();

    this.updateCurrentState({
      isDubbingActive: false,
      lastSentSubtitle: null,
      lastSentTime: 0,
    });

    chrome.runtime.sendMessage({ action: "dubbingStopped" });
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
    if (!this.isMainContentScript) return;

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

  public pauseAllAudio(): void {
    this.audioPlayer.pauseAllAudio();
  }

  public resumeAudioFromTime(currentTimeMs: number): void {
    if (this.videoManager.getVideoElement()?.paused) {
      return;
    }

    this.audioPlayer.resumeAllAudio();
    const adjustedTimeMs = currentTimeMs - this.currentState.subtitleOffset;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);

    for (const subtitle of currentSubtitles) {
      const audioOffsetSeconds = Math.max(
        0,
        (adjustedTimeMs - subtitle.start) / 1000
      );
      this.playAudioIfAvailable(subtitle, audioOffsetSeconds);
    }
  }

  public async playCurrentSubtitles(currentTimeMs: number): Promise<void> {
    if (this.videoManager.getVideoElement()?.paused) {
      return;
    }

    const adjustedTimeMs = currentTimeMs - this.currentState.subtitleOffset;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);

    for (const subtitle of currentSubtitles) {
      const isPlaying = this.isSubtitlePlaying(subtitle);

      if (!isPlaying) {
        const audioOffsetSeconds = Math.max(
          0,
          (adjustedTimeMs - subtitle.start) / 1000
        );
        await this.playAudioIfAvailable(subtitle, audioOffsetSeconds);
      }
    }
  }

  private isSubtitlePlaying(subtitle: Subtitle): boolean {
    const audioFilePath = this.getAudioFilePath(subtitle);
    return this.audioPlayer.isAudioActive(audioFilePath);
  }

  private async prepareAndPlaySubtitle(
    subtitle: Subtitle,
    adjustedTimeMs: number
  ): Promise<void> {
    const startTimeMs = subtitle.start;

    if (adjustedTimeMs >= startTimeMs && adjustedTimeMs < subtitle.end) {
      const audioOffsetSeconds = Math.max(
        0,
        (adjustedTimeMs - startTimeMs) / 1000
      );
      await this.playAudioIfAvailable(subtitle, audioOffsetSeconds);
    }
  }

  private async playAudioIfAvailable(
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const filePath = this.getAudioFilePath(subtitle);
    const cachedBuffer = await this.audioFileManager.getAudioBuffer(
      filePath,
      subtitle.text
    );

    if (cachedBuffer) {
      await this.audioPlayer.playAudio(
        cachedBuffer,
        filePath,
        subtitle,
        offset
      );
    }
  }

  public sendCurrentSubtitleInfo(
    currentTimeMs: number,
    currentSubtitles: Subtitle[]
  ): void {
    if (!this.isMainContentScript) return;

    const adjustedTimeMs = currentTimeMs - this.currentState.subtitleOffset;

    const allSubtitles =
      this.subtitleManager.getActiveSubtitles().length > 0
        ? this.subtitleManager.getSubtitlesAroundTime(adjustedTimeMs, 5)
        : [];

    chrome.runtime.sendMessage({
      action: "updateSubtitles",
      subtitles: allSubtitles,
    });

    if (currentSubtitles.length > 0) {
      const currentSubtitle = currentSubtitles[0];

      if (this.currentState.lastSentSubtitle?.start !== currentSubtitle.start) {
        this.updateCurrentState({
          lastSentSubtitle: currentSubtitle,
          lastSentTime: adjustedTimeMs,
        });
      }
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

  public async checkAndGenerateUpcomingAudio(
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
        const cachedBuffer = await this.audioFileManager.getAudioBuffer(
          filePath,
          subtitle.text
        );
        if (!cachedBuffer) {
          try {
            const audioBuffer = await this.audioFileManager.fetchAudioFile(
              filePath,
              subtitle.text
            );
            if (audioBuffer) {
              await this.audioFileManager.cacheAudioBuffer(
                filePath,
                audioBuffer
              );
            }
          } catch (error) {
            console.error(
              `Error fetching or generating audio for ${filePath}:`,
              error
            );
          }
        }
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

  public applySettingsChanges(settings: {
    subtitleOffset: number;
    dubbingVolumeMultiplier: number;
    videoVolumeWhilePlayingDubbing: number;
    dubbingVoice: DubbingVoice;
  }): void {
    this.updateCurrentState({
      subtitleOffset: settings.subtitleOffset * 1000,
      dubbingVoice: settings.dubbingVoice,
    });
    this.audioPlayer.setDubbingVolumeMultiplier(
      settings.dubbingVolumeMultiplier
    );
    this.setVideoVolumeWhilePlayingDubbing(
      settings.videoVolumeWhilePlayingDubbing
    );
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
          case "applySettingsChanges":
            this.applySettingsChanges(message.payload);
            sendResponse({ status: "updated" });
            break;
          case "stopDubbing":
            this.stop();
            sendResponse({ status: "stopped" });
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

  public isMain(): boolean {
    return this.isMainContentScript;
  }
}
