import config from "./config";
import { Subtitle } from "@/types";
import { DubbingManager } from "./DubbingManager";
import { SubtitleManager } from "./SubtitleManager";
import { AudioPlayer } from "./AudioPlayer";
import { SubtitleAligner } from "./SubtitleAligner"; // Import the new class

export class VideoManager {
  private videoElement: HTMLVideoElement | null = null;
  private isAdjustingVolume: boolean = false;
  private dubbingManager: DubbingManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private currentVideoPlayerVolume: number = 1;
  private originalVideoVolume: number = 1;
  private audioContext: AudioContext | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;

  constructor(dubbingManager: DubbingManager) {
    this.dubbingManager = dubbingManager;
    this.subtitleManager = SubtitleManager.getInstance();
    this.audioPlayer = this.dubbingManager.getAudioPlayer();
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
    }
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
        // If we can't access the iframe directly, we'll use a message passing approach
        this.setupIframeMessageListener(iframe);
      }
    }

    this.setupVideoObserver();
  }

  private setupIframeMessageListener(iframe: HTMLIFrameElement): void {
    window.addEventListener("message", (event) => {
      if (event.source === iframe.contentWindow) {
        if (event.data.type === "VIDEO_ELEMENT_FOUND") {
          this.handleIframeVideo(iframe);
        }
      }
    });

    // Send a message to the iframe to find the video element
    iframe.contentWindow?.postMessage({ type: "FIND_VIDEO_ELEMENT" }, "*");
  }

  private handleIframeVideo(iframe: HTMLIFrameElement): void {
    // Create a proxy video element
    const proxyVideo = document.createElement("video");

    // Set up message passing for video events and properties
    window.addEventListener("message", (event) => {
      if (event.source === iframe.contentWindow) {
        if (event.data.type === "VIDEO_EVENT") {
          proxyVideo.dispatchEvent(new Event(event.data.eventName));
        } else if (event.data.type === "VIDEO_PROPERTY_UPDATE") {
          (proxyVideo as any)[event.data.property] = event.data.value;
        }
      }
    });

    // Override video methods to send messages to the iframe
    const videoMethods = ["play", "pause", "load"];
    videoMethods.forEach((method) => {
      (proxyVideo as any)[method] = () => {
        iframe.contentWindow?.postMessage(
          { type: "VIDEO_METHOD", method },
          "*"
        );
      };
    });

    this.videoElement = proxyVideo;
    this.handleVideo(proxyVideo);
    this.setDubbingActiveFlag();
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

    this.initializeAudioContext();
    this.createAudioSourceNode();
    this.connectAudioNodes();
  }

  private createAudioSourceNode(): void {
    if (this.audioContext && this.videoElement && !this.audioSourceNode) {
      this.audioSourceNode = this.audioContext.createMediaElementSource(
        this.videoElement
      );
      this.connectAudioNodes();
    }
  }

  private connectAudioNodes(): void {
    if (this.audioSourceNode && this.audioContext) {
      this.audioSourceNode.disconnect();
      this.audioSourceNode.connect(this.audioContext.destination);
    }
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
      this.dubbingManager.playCurrentSubtitles(currentTimeMs);
      this.dubbingManager.notifyBackgroundScript(true);
    }

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }
  };

  private handleVideoPause = (): void => {
    if (this.dubbingManager.isDubbingActive) {
      this.audioPlayer.pauseAllAudio();
      this.dubbingManager.notifyBackgroundScript(false);
    }
    this.restoreOriginalVideoVolume();
  };

  private handleVideoSeeking = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    const newTimeMs = video.currentTime * 1000;

    this.audioPlayer.pauseAllAudio();
    this.dubbingManager.updateCurrentState({ lastVideoTime: newTimeMs });

    if (this.dubbingManager.isDubbingActive) {
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
  };

  private handlePreciseTime = (currentTimeMs: number): void => {
    const adjustedTimeMs =
      currentTimeMs - this.dubbingManager.getSubtitleOffset();

    if (this.videoElement) {
      this.adjustVolume(this.videoElement);
    }

    this.dubbingManager.playCurrentSubtitles(adjustedTimeMs);
    this.audioPlayer.fadeOutExpiredAudio(adjustedTimeMs);
    this.dubbingManager.sendCurrentSubtitleInfo(
      adjustedTimeMs,
      this.subtitleManager.getCurrentSubtitles(adjustedTimeMs)
    );
    this.dubbingManager.checkAndGenerateUpcomingAudio(currentTimeMs);
  };

  public adjustVolume(video: HTMLVideoElement | null): void {
    if (!video) return;

    this.isAdjustingVolume = true;
    const isDubbingPlaying =
      this.audioPlayer.getCurrentlyPlayingSubtitles().length > 0;

    if (isDubbingPlaying && this.dubbingManager.isDubbingActive) {
      const adjustedVolume =
        this.currentVideoPlayerVolume *
        this.dubbingManager.getVideoVolumeWhilePlayingDubbing();
      video.volume = Math.max(0, Math.min(1, adjustedVolume));
    } else {
      video.volume = this.originalVideoVolume;
    }

    if (this.audioSourceNode && this.audioContext) {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(video.volume, this.audioContext.currentTime);
      this.audioSourceNode.disconnect();
      this.audioSourceNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
    }

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

  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  public getAudioSourceNode(): MediaElementAudioSourceNode | null {
    return this.audioSourceNode;
  }
}
