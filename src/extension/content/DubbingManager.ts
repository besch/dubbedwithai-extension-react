import { throttle } from "lodash";
import { AudioFileManager } from "./AudioFileManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { DubbingConfig, Subtitle } from "./types";
import { log, LogLevel } from "./utils";

const DEFAULT_DUBBING_CONFIG: DubbingConfig = {
  defaultVolume: 1,
  dubbingVolume: 0.3,
  preloadTime: 5,
  subtitleUpdateInterval: 0.5,
};

interface AudioGenerationRequest {
  subtitle: Subtitle;
  filePath: string;
  inProgress: boolean;
}

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
  private audioGenerationQueue: Map<string, AudioGenerationRequest> = new Map();

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
    const currentTime = video.currentTime * 1000; // Convert to milliseconds
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

    const currentTimeMs = currentTime * 1000; // Convert currentTime to milliseconds
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      currentTimeMs,
      60000 // 60 seconds in milliseconds
    );

    for (const subtitle of upcomingSubtitles) {
      const filePath = this.getAudioFilePath(subtitle);

      if (
        this.audioGenerationQueue.has(filePath) ||
        (await this.audioFileManager.checkFileExists(filePath))
      ) {
        continue; // Skip if already in queue or exists
      }

      this.audioGenerationQueue.set(filePath, {
        subtitle,
        filePath,
        inProgress: false,
      });
    }

    // Process the queue
    await this.processAudioGenerationQueue();
  }

  private async processAudioGenerationQueue(): Promise<void> {
    const entries = Array.from(this.audioGenerationQueue.entries());
    for (const [filePath, request] of entries) {
      if (!request.inProgress) {
        request.inProgress = true;
        try {
          await this.requestAudioGenerationWithRetry(
            request.subtitle,
            filePath
          );
          this.audioGenerationQueue.delete(filePath);
        } catch (error) {
          console.error(`Failed to generate audio for ${filePath}:`, error);
          request.inProgress = false;
        }
      }
    }
  }

  private async requestAudioGenerationWithRetry(
    subtitle: Subtitle,
    filePath: string,
    retryCount: number = 0
  ): Promise<void> {
    try {
      await this.requestAudioGeneration(subtitle);
    } catch (error) {
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.requestAudioGenerationWithRetry(
          subtitle,
          filePath,
          retryCount + 1
        );
      } else {
        throw error; // Throw error after max retries
      }
    }
  }

  private async requestAudioGeneration(subtitle: Subtitle): Promise<void> {
    return new Promise((resolve, reject) => {
      const filePath = this.getAudioFilePath(subtitle);
      chrome.runtime.sendMessage(
        {
          action: "generateAudio",
          text: subtitle.text,
          filePath: filePath,
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

  private async preloadUpcomingSubtitles(currentTime: number): Promise<void> {
    const adjustedTime = currentTime - this.subtitleOffset;
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      adjustedTime,
      this.config.preloadTime * 1000
    );

    console.log(`Preloading ${upcomingSubtitles.length} upcoming subtitles`);

    const preloadPromises = upcomingSubtitles.map(async (subtitle) => {
      const filePath = this.getAudioFilePath(subtitle);
      try {
        if (this.audioGenerationQueue.has(filePath)) {
          console.log(
            `Audio generation in progress for subtitle: ${subtitle.text}`
          );
          return;
        }

        const exists = await this.audioFileManager.checkFileExists(filePath);
        if (exists) {
          await this.audioFileManager.getAudioBuffer(filePath);
          console.log(`Preloaded audio for subtitle: ${subtitle.text}`);
        } else {
          console.log(
            `Audio file not found for subtitle: ${subtitle.text}. Queueing for generation.`
          );
          this.audioGenerationQueue.set(filePath, {
            subtitle,
            filePath,
            inProgress: false,
          });
        }
      } catch (error) {
        console.error(
          `Failed to preload audio for subtitle: ${subtitle.text}`,
          error
        );
      }
    });

    await Promise.all(preloadPromises);
    await this.processAudioGenerationQueue();
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

  private playCurrentSubtitles(currentTime: number): void {
    const adjustedTime = currentTime * 1000 - this.subtitleOffset;

    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTime);
    currentSubtitles.forEach((subtitle) => {
      const audioFilePath = this.getAudioFilePath(subtitle);
      const startTime = subtitle.start / 1000; // Convert to seconds
      const endTime = subtitle.end / 1000; // Convert to seconds

      if (
        adjustedTime >= subtitle.start &&
        adjustedTime < subtitle.end &&
        !this.audioPlayer.isAudioActive(audioFilePath)
      ) {
        const audioOffset = Math.max(0, adjustedTime / 1000 - startTime);
        this.playAudioIfAvailable(subtitle, audioOffset);
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
