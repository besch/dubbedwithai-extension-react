export class PrecisionTimer {
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPaused: boolean = true;
  private intervalId: number | null = null;
  private lastUpdateTime: number = 0;
  private updateInterval: number = 50; // Update every 50ms
  private significantChangeThreshold: number = 0.1; // 100ms

  constructor(private callback: (time: number) => void) {}

  start(initialTime: number = 0) {
    this.startTime = performance.now() - initialTime * 1000;
    this.isPaused = false;
    this.lastUpdateTime = initialTime;
    this.pausedTime = initialTime;
    this.startInterval();
  }

  pause() {
    if (!this.isPaused) {
      this.isPaused = true;
      this.pausedTime = this.getCurrentTime();
      this.stopInterval();
    }
  }

  resume() {
    if (this.isPaused) {
      this.isPaused = false;
      this.startTime = performance.now() - this.pausedTime * 1000;
      this.startInterval();
    }
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

  setUpdateInterval(interval: number) {
    this.updateInterval = interval;
    if (!this.isPaused) {
      this.stopInterval();
      this.startInterval();
    }
  }

  private startInterval() {
    this.stopInterval(); // Ensure no existing interval
    this.intervalId = window.setInterval(
      () => this.tick(),
      this.updateInterval
    );
  }

  private stopInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
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
    return timeSinceLastUpdate >= this.significantChangeThreshold;
  }
}
