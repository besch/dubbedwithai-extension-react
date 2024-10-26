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
    this.subtitleManager = SubtitleManager.getInstance();
    this.audioPlayer = this.dubbingManager.getAudioPlayer();
  }

  public async findAndStoreVideoElement(): Promise<void> {
    const isDubbingActive =
      await this.dubbingManager.isDubbingActiveInAnyFrame();
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

  private setDubbingActiveFlag(): void {
    window.top?.postMessage({ type: "SET_DUBBING_ACTIVE" }, "*");
  }

  private handleVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    this.currentVideoPlayerVolume = video.volume;
    this.originalVideoVolume = video.volume;
    this.removeVideoEventListeners();
    video.addEventListener("play", this.handleVideoPlay);
    video.addEventListener("pause", this.handleVideoPause);
    video.addEventListener("seeking", this.handleVideoSeeking);
    video.addEventListener("volumechange", this.handleVolumeChange);
    video.addEventListener("timeupdate", this.handleTimeUpdate);
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

  private handleVideoPlay = (): void => {
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

    this.adjustVolumeBasedOnSubtitles(currentTimeMs);
  };

  private async adjustVolumeGradually(
    video: HTMLVideoElement,
    targetVolume: number,
    duration: number = 200
  ): Promise<void> {
    const startVolume = video.volume;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easeInOutQuad for smoother transition
      const easeProgress =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      video.volume = startVolume + (targetVolume - startVolume) * easeProgress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  private adjustVolumeBasedOnSubtitles(currentTimeMs: number): void {
    if (!this.videoElement || !this.dubbingManager.isDubbingActive) {
      return;
    }

    const subtitleOffset = this.dubbingManager.getSubtitleOffset();
    const adjustedTimeMs = currentTimeMs - subtitleOffset;

    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs);

    if (currentSubtitles.length > 0) {
      this.adjustVolumeGradually(
        this.videoElement,
        this.dubbingManager.getVideoVolumeWhilePlayingDubbing()
      );
    } else {
      this.adjustVolumeGradually(this.videoElement, this.originalVideoVolume);
    }
  }

  private handlePreciseTime = (currentTimeMs: number): void => {
    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }

    this.dubbingManager.playCurrentSubtitles(currentTimeMs);
    this.audioPlayer.fadeOutExpiredAudio(currentTimeMs);
    this.dubbingManager.sendCurrentSubtitleInfo(
      currentTimeMs,
      this.subtitleManager.getCurrentSubtitles(currentTimeMs)
    );
    this.dubbingManager.checkAndGenerateUpcomingAudio(currentTimeMs);
  };

  public adjustVolume(video: HTMLVideoElement | null): void {
    if (!video) return;

    this.isAdjustingVolume = true;

    const currentTimeMs = this.getCurrentVideoTimeMs();
    this.adjustVolumeBasedOnSubtitles(currentTimeMs);

    setTimeout(() => {
      this.isAdjustingVolume = false;
    }, 50);
  }

  public restoreOriginalVideoVolume(): void {
    if (this.videoElement && this.originalVideoVolume !== undefined) {
      this.adjustVolumeGradually(this.videoElement, this.originalVideoVolume);
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
