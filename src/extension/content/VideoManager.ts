import config from "./config";
import { DubbingManager } from "./DubbingManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";

export class VideoManager {
  private videoElement: HTMLVideoElement | null = null;
  private isAdjustingVolume: boolean = false;
  private dubbingManager: DubbingManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private currentVideoPlayerVolume: number = 1;
  private originalVideoVolume: number = 1;

  constructor(dubbingManager: DubbingManager) {
    this.dubbingManager = dubbingManager;
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = this.dubbingManager.getAudioPlayer();
  }

  public async findAndStoreVideoElement(): Promise<void> {
    const video = document.querySelector("video");
    if (video) {
      this.handleVideo(video);
      this.setupVideoEventListeners(video);
    }
  }

  public setupVideoEventListeners(video: HTMLVideoElement): void {
    this.removeVideoEventListeners();
    video.addEventListener("play", this.handleVideoPlay);
    video.addEventListener("pause", this.handleVideoPause);
    video.addEventListener("seeking", this.handleVideoSeeking);
    video.addEventListener("volumechange", this.handleVolumeChange);
    video.addEventListener("timeupdate", this.handleTimeUpdate);
  }

  private handleVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.currentVideoPlayerVolume = video.volume;
    this.originalVideoVolume = video.volume;
    this.setupVideoEventListeners(video);
  }

  public removeVideoEventListeners(): void {
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

  public handleVideoPlay = (): void => {
    const currentTimeMs = this.getCurrentVideoTimeMs();

    if (this.dubbingManager.isDubbingActive) {
      this.dubbingManager.updateCurrentState({ lastVideoTime: currentTimeMs });
      this.dubbingManager.resumeAudioFromTime(currentTimeMs);
      this.dubbingManager.notifyBackgroundScript(true);
    }

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  };

  private handleVideoPause = (): void => {
    if (this.dubbingManager.isDubbingActive) {
      this.dubbingManager.pauseAllAudio();
      this.dubbingManager.notifyBackgroundScript(false);
    }
    this.restoreOriginalVideoVolume();
  };

  private handleVideoSeeking = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const newTimeMs = video.currentTime * 1000;

    this.audioPlayer.pauseAllAudio();
    this.dubbingManager.updateCurrentState({ lastVideoTime: newTimeMs });

    if (this.dubbingManager.isDubbingActive && !video.paused) {
      this.dubbingManager.playCurrentSubtitles(newTimeMs);
      this.dubbingManager.notifyBackgroundScript(true);
    }
  };

  private handleVolumeChange = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const newVolume = video.volume;

    if (Math.abs(newVolume - this.currentVideoPlayerVolume) > 0.01) {
      if (!this.isAdjustingVolume) {
        this.currentVideoPlayerVolume = newVolume;
        this.dubbingManager.updateCurrentState({
          currentVideoPlayerVolume: newVolume,
        });
      }
    }
  };

  private handleTimeUpdate = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const currentTimeMs = video.currentTime * 1000;

    if (
      Math.abs(currentTimeMs - this.dubbingManager.getLastVideoTime()) >=
      config.videoTimeUpdateInterval
    ) {
      this.dubbingManager.updateCurrentState({ lastVideoTime: currentTimeMs });
      this.handlePreciseTime(currentTimeMs);
    }

    const isAudioPlaying = this.dubbingManager.isAnyDubbingAudioPlaying();
    this.adjustVolumeBasedOnPlayback(isAudioPlaying);
  };

  private handlePreciseTime = (currentTimeMs: number): void => {
    const isAudioPlaying = this.dubbingManager.isAnyDubbingAudioPlaying();
    this.adjustVolumeBasedOnPlayback(isAudioPlaying);

    this.dubbingManager.playCurrentSubtitles(currentTimeMs);
    this.audioPlayer.fadeOutExpiredAudio(currentTimeMs);
    this.dubbingManager.sendCurrentSubtitleInfo(
      currentTimeMs,
      this.subtitleManager.getCurrentSubtitles(currentTimeMs)
    );
    this.dubbingManager.checkAndGenerateUpcomingAudio(currentTimeMs);
  };

  private adjustVolumeBasedOnPlayback(isAudioPlaying: boolean): void {
    if (!this.videoElement || !this.dubbingManager.isDubbingActive) {
      return;
    }

    this.isAdjustingVolume = true;
    if (isAudioPlaying) {
      this.videoElement.volume =
        this.dubbingManager.getVideoVolumeWhilePlayingDubbing();
    } else {
      this.videoElement.volume = this.originalVideoVolume;
    }
    this.currentVideoPlayerVolume = this.videoElement.volume;

    // Reset the adjusting flag after a short delay
    setTimeout(() => {
      this.isAdjustingVolume = false;
    }, 50);
  }

  public adjustVolume(video: HTMLVideoElement | null): void {
    if (!video) return;

    this.isAdjustingVolume = true;
    const isAudioPlaying = this.dubbingManager.isAnyDubbingAudioPlaying();

    if (isAudioPlaying) {
      video.volume = this.dubbingManager.getVideoVolumeWhilePlayingDubbing();
    } else {
      video.volume = this.originalVideoVolume;
    }
    this.currentVideoPlayerVolume = video.volume;

    setTimeout(() => {
      this.isAdjustingVolume = false;
    }, 50);
  }

  public restoreOriginalVideoVolume(): void {
    if (this.videoElement && this.originalVideoVolume !== undefined) {
      this.videoElement.volume = this.originalVideoVolume;
      this.currentVideoPlayerVolume = this.originalVideoVolume;
      this.dubbingManager.updateCurrentState({
        currentVideoPlayerVolume: this.originalVideoVolume,
      });
    }
  }

  public getCurrentVideoTimeMs(): number {
    return this.videoElement ? this.videoElement.currentTime * 1000 : 0;
  }

  public hasVideoElement(): boolean {
    return !!this.videoElement;
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public getCurrentVideoPlayerVolume(): number {
    return this.currentVideoPlayerVolume;
  }

  public setCurrentVideoPlayerVolume(volume: number): void {
    this.currentVideoPlayerVolume = volume;
  }

  public setupUnloadListener(): void {
    window.addEventListener("beforeunload", this.handlePageUnload);
  }

  private handlePageUnload = (): void => {
    this.restoreOriginalVideoVolume();
  };
}
