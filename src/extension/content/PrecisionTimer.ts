import config from "./config";

export class PrecisionTimer {
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPaused: boolean = true;
  private intervalId: number | null = null;
  private lastUpdateTime: number = 0;
  private videoElement: HTMLVideoElement | null = null;

  constructor(
    private callback: (time: number) => void,
    videoElement: HTMLVideoElement | null = null
  ) {
    this.videoElement = videoElement;
  }

  start(initialTime: number = 0) {
    this.startTime = performance.now() - initialTime * 1000;
    this.isPaused = this.videoElement ? this.videoElement.paused : false;
    this.lastUpdateTime = initialTime;
    this.pausedTime = initialTime;
    this.startInterval();
  }

  pause() {
    this.isPaused = true;
    this.pausedTime = this.getCurrentTime();
    this.stopInterval();
  }

  resume() {
    if (this.videoElement && this.videoElement.paused) {
      return; // Don't resume if video is paused
    }
    this.isPaused = false;
    this.startTime = performance.now() - this.pausedTime * 1000;
    this.startInterval();
  }

  stop() {
    this.isPaused = true;
    this.stopInterval();
  }

  reset() {
    this.stop();
    this.startTime = 0;
    this.pausedTime = 0;
    this.isPaused = true;
    this.lastUpdateTime = 0;
  }

  getCurrentTime(): number {
    if (this.isPaused) {
      return this.pausedTime;
    }
    return (performance.now() - this.startTime) / 1000;
  }

  setVideoElement(videoElement: HTMLVideoElement | null) {
    this.videoElement = videoElement;
  }

  setprecisionTimerUpdateInterval(interval: number) {
    config.precisionTimerUpdateInterval = interval;
    if (!this.isPaused) {
      this.stopInterval();
      this.startInterval();
    }
  }

  private startInterval() {
    this.stopInterval(); // Ensure no existing interval
    this.intervalId = window.setInterval(
      () => this.tick(),
      config.precisionTimerUpdateInterval
    );
  }

  private stopInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    if (this.videoElement) {
      this.isPaused = this.videoElement.paused;
    }

    if (!this.isPaused) {
      const currentTime = this.getCurrentTime();
      if (this.shouldUpdate(currentTime)) {
        this.callback(currentTime);
        this.lastUpdateTime = currentTime;
      }
    }
  }

  private shouldUpdate(currentTime: number): boolean {
    const timeSinceLastUpdate = currentTime - this.lastUpdateTime;
    return (
      timeSinceLastUpdate >= config.precisionTimerSignificantChangeThreshold
    );
  }
}
