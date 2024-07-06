interface Subtitle {
  start: string;
  end: string;
  text: string;
}

enum LogLevel {
  INFO,
  WARN,
  ERROR,
}

function log(level: LogLevel, message: string, ...args: any[]): void {
  const prefix = LogLevel[level];
  console[
    level === LogLevel.ERROR
      ? "error"
      : level === LogLevel.WARN
      ? "warn"
      : "log"
  ](`[${prefix}]`, message, ...args);
}

function timeStringToSeconds(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":");
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseFloat(seconds.replace(",", "."))
  );
}

function getAudioFileName(subtitle: { start: string; end: string }): string {
  const startMs = timeStringToMilliseconds(subtitle.start);
  const endMs = timeStringToMilliseconds(subtitle.end);
  return `${startMs}-${endMs}.mp3`;
}

function timeStringToMilliseconds(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":");
  const [secs, ms] = seconds.split(",");
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(secs) * 1000 +
    parseInt(ms)
  );
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

class AudioCache {
  private dbName = "AudioCache";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.initIndexedDB();
  }

  private initIndexedDB(): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);

    request.onerror = (event) => {
      log(LogLevel.ERROR, "IndexedDB error:", event);
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore("audioFiles", { keyPath: "fileName" });
    };
  }

  async getAudio(fileName: string): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction(["audioFiles"], "readonly");
      const store = transaction.objectStore("audioFiles");
      const request = store.get(fileName);

      request.onsuccess = () => {
        resolve(request.result ? request.result.audioData : null);
      };

      request.onerror = () => {
        log(
          LogLevel.ERROR,
          "Error fetching audio from IndexedDB:",
          request.error
        );
        resolve(null);
      };
    });
  }

  async storeAudio(fileName: string, audioData: ArrayBuffer): Promise<void> {
    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["audioFiles"], "readwrite");
      const store = transaction.objectStore("audioFiles");
      const request = store.put({ fileName, audioData });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

class SubtitleManager {
  private subtitlesCache: Map<string, Subtitle[]> = new Map();
  private subtitleRequests: Map<string, Promise<Subtitle[] | null>> = new Map();
  private sortedSubtitles: Subtitle[] = [];

  getUpcomingSubtitles(currentTime: number, preloadTime: number): Subtitle[] {
    const upcomingSubtitles = this.sortedSubtitles.filter((subtitle) => {
      const startTime = timeStringToSeconds(subtitle.start);
      return startTime > currentTime && startTime <= currentTime + preloadTime;
    });
    return upcomingSubtitles;
  }

  public reset(): void {
    this.sortedSubtitles = [];
    // Reset any other state in the SubtitleManager
  }

  async getSubtitles(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    const cacheKey = `${movieId}-${subtitleId}`;

    const cachedSubtitles = this.subtitlesCache.get(cacheKey);
    if (cachedSubtitles) {
      return cachedSubtitles;
    }

    if (!this.subtitleRequests.has(cacheKey)) {
      const subtitlePromise = new Promise<Subtitle[] | null>((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "requestSubtitles",
            movieId: movieId,
            subtitleId: subtitleId,
          },
          (response: any) => {
            if (response && response.action === "subtitlesData") {
              this.subtitlesCache.set(cacheKey, response.data);
              this.sortSubtitles(response.data);
              resolve(response.data);
            } else {
              resolve(null);
            }
          }
        );
      });

      this.subtitleRequests.set(cacheKey, subtitlePromise);
    }

    const subtitleRequestPromise = this.subtitleRequests.get(cacheKey);
    if (subtitleRequestPromise) {
      const subtitles = await subtitleRequestPromise;
      this.subtitleRequests.delete(cacheKey);
      return subtitles;
    }

    return null;
  }

  private sortSubtitles(subtitles: Subtitle[]): void {
    this.sortedSubtitles = [...subtitles].sort(
      (a, b) => timeStringToSeconds(a.start) - timeStringToSeconds(b.start)
    );
  }

  getCurrentSubtitles(currentTime: number): Subtitle[] {
    const index = this.sortedSubtitles.findIndex(
      (subtitle) => timeStringToSeconds(subtitle.end) > currentTime
    );
    if (index === -1) return [];

    const currentSubtitles: Subtitle[] = [];
    for (let i = index; i < this.sortedSubtitles.length; i++) {
      const subtitle = this.sortedSubtitles[i];
      if (timeStringToSeconds(subtitle.start) > currentTime) break;
      if (timeStringToSeconds(subtitle.end) > currentTime) {
        currentSubtitles.push(subtitle);
      }
    }
    return currentSubtitles;
  }
}

class AudioPlayer {
  private audioContext: AudioContext;
  private activeAudio: Map<
    string,
    { source: AudioBufferSourceNode; subtitle: Subtitle }
  > = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  async playAudio(
    buffer: AudioBuffer,
    fileName: string,
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    source.start(0, offset);

    this.activeAudio.set(fileName, { source, subtitle });

    source.onended = () => {
      this.activeAudio.delete(fileName);
    };
  }

  stopAudio(fileName: string): void {
    if (this.activeAudio.has(fileName)) {
      const audioInfo = this.activeAudio.get(fileName);
      if (audioInfo) {
        audioInfo.source.stop();
        this.activeAudio.delete(fileName);
      }
    }
  }

  stopAllAudio(): void {
    this.activeAudio.forEach((audioInfo, fileName) => {
      this.stopAudio(fileName);
    });
    this.activeAudio.clear();
  }

  isAudioActive(fileName: string): boolean {
    return this.activeAudio.has(fileName);
  }

  stopExpiredAudio(currentTime: number): void {
    this.activeAudio.forEach((audioInfo, fileName) => {
      if (currentTime >= timeStringToSeconds(audioInfo.subtitle.end)) {
        this.stopAudio(fileName);
      }
    });
  }

  getActiveAudioInfo(): Map<string, { subtitle: Subtitle }> {
    return new Map(
      Array.from(this.activeAudio.entries()).map(([key, value]) => [
        key,
        { subtitle: value.subtitle },
      ])
    );
  }

  setVolume(volume: number): void {
    // Assuming we want to set the volume for all active audio
    // You might want to adjust this based on your specific requirements
    this.activeAudio.forEach((audioInfo) => {
      const gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      audioInfo.source.disconnect();
      audioInfo.source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
    });
  }

  getCurrentlyPlayingSubtitles(): Subtitle[] {
    return Array.from(this.activeAudio.values()).map(
      (audioInfo) => audioInfo.subtitle
    );
  }

  // Helper method to get the AudioContext
  getAudioContext(): AudioContext {
    return this.audioContext;
  }
}

class DubbingManager {
  private sortedSubtitles: Subtitle[] = [];
  private audioCache: AudioCache;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private audioContext: AudioContext;
  private preloadedAudio: Map<string, AudioBuffer> = new Map();
  private originalVolume = 1;
  private currentMovieId: string | null = null;
  private currentSubtitleId: string | null = null;
  private isVideoPaused = false;
  private lastSentSubtitle: Subtitle | null = null;
  private lastSentTime: number = 0;
  private preloadTime = 5; // Added this line

  constructor() {
    this.audioContext = new window.AudioContext();
    this.audioCache = new AudioCache();
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.setupMessageListener();
    this.checkAndApplyDubbing();

    this.handleVideoPlay = this.handleVideoPlay.bind(this);
    this.handleVideoPause = this.handleVideoPause.bind(this);
    this.handleVideoSeeking = this.handleVideoSeeking.bind(this);
    this.handleVolumeChange = this.handleVolumeChange.bind(this);
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
  }

  public stopDubbing(): void {
    // Stop all audio playback
    this.audioPlayer.stopAllAudio();

    // Clear preloaded audio
    this.preloadedAudio.clear();

    // Reset subtitle manager
    this.subtitleManager.reset();

    // Reset current movie and subtitle IDs
    this.currentMovieId = null;
    this.currentSubtitleId = null;

    // Reset video state
    this.isVideoPaused = false;

    // Reset last sent subtitle info
    this.lastSentSubtitle = null;
    this.lastSentTime = 0;

    // Restore original volume
    const video = document.querySelector("video");
    if (video) {
      video.volume = this.originalVolume;
    }

    // Remove video event listeners
    this.removeVideoEventListeners();

    log(LogLevel.INFO, "Dubbing stopped");
  }

  private removeVideoEventListeners(): void {
    const video = document.querySelector("video");
    if (video) {
      const eventHandlers: { [key: string]: (event: Event) => void } = {
        play: (event) => this.handleVideoPlay(event.target as HTMLVideoElement),
        pause: () => this.handleVideoPause(),
        seeking: (event) =>
          this.handleVideoSeeking(event.target as HTMLVideoElement),
        volumechange: (event) =>
          this.handleVolumeChange(event.target as HTMLVideoElement),
        timeupdate: (event) =>
          this.handleTimeUpdate(event.target as HTMLVideoElement),
      };

      Object.entries(eventHandlers).forEach(([event, handler]) => {
        video.removeEventListener(event, handler);
      });
    }
  }

  private async getAudioBuffer(fileName: string): Promise<AudioBuffer | null> {
    const preloadedBuffer = this.preloadedAudio.get(fileName);
    if (preloadedBuffer) return preloadedBuffer;

    const cachedAudio = await this.audioCache.getAudio(fileName);
    if (cachedAudio) {
      try {
        const buffer = await this.audioContext.decodeAudioData(cachedAudio);
        this.preloadedAudio.set(fileName, buffer);
        return buffer;
      } catch (e) {
        log(LogLevel.ERROR, "Error decoding cached audio data:", e);
      }
    }

    return this.fetchAudioBuffer(fileName);
  }

  private async fetchAudioBuffer(
    fileName: string
  ): Promise<AudioBuffer | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "requestAudioFile",
          movieId: this.currentMovieId,
          subtitleId: this.currentSubtitleId,
          fileName: fileName,
        },
        async (response: any) => {
          if (
            response &&
            response.action === "audioFileData" &&
            response.data
          ) {
            const audioData = base64ToArrayBuffer(response.data);
            try {
              const buffer = await this.audioContext.decodeAudioData(audioData);
              this.preloadedAudio.set(fileName, buffer);
              await this.audioCache.storeAudio(fileName, audioData);
              resolve(buffer);
            } catch (e) {
              log(LogLevel.ERROR, "Error decoding audio data:", e);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (
        message: { action: string; movieId?: string; subtitleId?: string },
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
      ) => {
        if (message.action === "applyDubbing") {
          if (message.movieId && message.subtitleId) {
            this.handleApplyDubbing(message.movieId, message.subtitleId);
          } else {
            console.error("applyDubbing action missing movieId or subtitleId");
          }
        } else if (message.action === "stopDubbing") {
          this.stopDubbing();
        } else if (message.action === "checkDubbingStatus") {
          this.checkAndApplyDubbing();
        }
      }
    );
  }

  private checkAndApplyDubbing(): void {
    chrome.storage.local.get(["movieState"], (result) => {
      const movieState = result.movieState;
      if (
        movieState &&
        movieState.isDubbingActive &&
        movieState.selectedMovie &&
        movieState.selectedLanguage
      ) {
        this.handleApplyDubbing(
          movieState.selectedMovie.imdbID,
          movieState.selectedLanguage.id
        );
      }
    });
  }

  private async handleApplyDubbing(
    movieId: string,
    subtitleId: string
  ): Promise<void> {
    this.currentMovieId = movieId;
    this.currentSubtitleId = subtitleId;

    try {
      const subtitles = await this.subtitleManager.getSubtitles(
        movieId,
        subtitleId
      );
      if (subtitles) {
        this.findAndHandleVideo();
      } else {
        throw new Error(
          `Failed to load subtitles for movie ${movieId} and subtitle ${subtitleId}`
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log(LogLevel.ERROR, `Error applying dubbing: ${errorMessage}`);
    }
  }

  private handleVideo(video: HTMLVideoElement): void {
    console.log("found video tag");
    this.originalVolume = video.volume;

    const eventHandlers: { [key: string]: (event: Event) => void } = {
      play: (event) => this.handleVideoPlay(event.target as HTMLVideoElement),
      pause: () => this.handleVideoPause(),
      seeking: (event) =>
        this.handleVideoSeeking(event.target as HTMLVideoElement),
      volumechange: (event) =>
        this.handleVolumeChange(event.target as HTMLVideoElement),
      timeupdate: (event) =>
        this.handleTimeUpdate(event.target as HTMLVideoElement),
    };

    Object.entries(eventHandlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });
  }

  private handleVideoPlay(video: HTMLVideoElement): void {
    console.log("Video played");
    this.isVideoPaused = false;
    this.stopAllAudio();
    this.playCurrentSubtitles(
      video.currentTime,
      this.getCurrentSubtitles(video.currentTime)
    );
  }

  private handleVideoPause(): void {
    console.log("Video paused");
    this.isVideoPaused = true;
    this.stopAllAudio();
  }

  private handleVideoSeeking(video: HTMLVideoElement): void {
    console.log("Video seeking");
    this.stopAllAudio();
    if (!this.isVideoPaused) {
      this.playCurrentSubtitles(
        video.currentTime,
        this.getCurrentSubtitles(video.currentTime)
      );
    }
  }

  private handleVolumeChange(video: HTMLVideoElement): void {
    const currentSubtitles = this.getCurrentSubtitles(video.currentTime);
    if (currentSubtitles.length === 0) {
      this.originalVolume = video.volume;
    }
  }

  private handleTimeUpdate(video: HTMLVideoElement): void {
    const currentTime = video.currentTime;
    const currentSubtitles = this.getCurrentSubtitles(currentTime);

    this.adjustVolume(video, currentSubtitles);
    if (!this.isVideoPaused) {
      this.playCurrentSubtitles(currentTime, currentSubtitles);
    }
    this.audioPlayer.stopExpiredAudio(currentTime);
    this.preloadUpcomingSubtitles(currentTime);

    // Send current subtitle info to the extension
    if (currentSubtitles.length > 0) {
      const currentSubtitle = currentSubtitles[0];
      const startTime = timeStringToSeconds(currentSubtitle.start);
      const endTime = timeStringToSeconds(currentSubtitle.end);

      if (
        currentSubtitle !== this.lastSentSubtitle ||
        currentTime - this.lastSentTime >= 0.5
      ) {
        const message = {
          action: "currentSubtitle",
          subtitle: {
            text: currentSubtitle.text,
            start: startTime,
            end: endTime,
            currentTime: currentTime,
          },
        };
        log(LogLevel.INFO, "Sending subtitle message:", message);
        chrome.runtime.sendMessage(message);

        this.lastSentSubtitle = currentSubtitle;
        this.lastSentTime = currentTime;
      }
    } else if (this.lastSentSubtitle !== null) {
      chrome.runtime.sendMessage({
        action: "currentSubtitle",
        subtitle: null,
      });
      this.lastSentSubtitle = null;
    }
  }

  private getCurrentSubtitles(currentTime: number): Subtitle[] {
    return this.subtitleManager.getCurrentSubtitles(currentTime);
  }

  private adjustVolume(
    video: HTMLVideoElement,
    currentSubtitles: Subtitle[]
  ): void {
    if (currentSubtitles.length > 0) {
      if (video.volume !== 0.3) {
        video.volume = 0.3;
      }
    } else {
      if (video.volume !== this.originalVolume) {
        video.volume = this.originalVolume;
      }
    }
  }

  private playCurrentSubtitles(
    currentTime: number,
    currentSubtitles: Subtitle[]
  ): void {
    currentSubtitles.forEach((subtitle) => {
      const audioFileName = getAudioFileName(subtitle);
      const startTime = timeStringToSeconds(subtitle.start);
      const endTime = timeStringToSeconds(subtitle.end);

      if (
        currentTime >= startTime &&
        currentTime < endTime &&
        !this.audioPlayer.isAudioActive(audioFileName)
      ) {
        this.playAudioIfAvailable(
          audioFileName,
          subtitle,
          currentTime - startTime
        );
      }
    });
  }

  private preloadUpcomingSubtitles(currentTime: number): void {
    const upcomingSubtitles = this.subtitleManager.getUpcomingSubtitles(
      currentTime,
      this.preloadTime
    );

    upcomingSubtitles.forEach((subtitle) => {
      const audioFileName = getAudioFileName(subtitle);
      if (!this.preloadedAudio.has(audioFileName)) {
        this.preloadAudio(audioFileName);
      }
    });
  }

  private async preloadAudio(fileName: string): Promise<void> {
    const buffer = await this.getAudioBuffer(fileName);
    if (buffer) {
      this.preloadedAudio.set(fileName, buffer);
    }
  }

  private async playAudioIfAvailable(
    fileName: string,
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const buffer = await this.getAudioBuffer(fileName);
    if (buffer) {
      this.audioPlayer.playAudio(buffer, fileName, subtitle, offset);
    } else {
      log(LogLevel.WARN, `Audio buffer not available for file: ${fileName}`);
    }
  }

  private stopAllAudio(): void {
    this.audioPlayer.stopAllAudio();
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

    // If no video is found, set up a MutationObserver to watch for video elements
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

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

const dubbingManager = new DubbingManager();
