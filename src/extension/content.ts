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
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

class AudioFileManager {
  private audioCache: AudioCache;
  private inMemoryCache: Map<string, AudioBuffer> = new Map();
  private ongoingRequests: Map<string, Promise<AudioBuffer | null>> = new Map();
  private requestedFiles: Set<string> = new Set();

  constructor(private audioContext: AudioContext) {
    this.audioCache = new AudioCache();
  }

  async getAudioBuffer(
    movieId: string,
    subtitleId: string,
    fileName: string
  ): Promise<AudioBuffer | null> {
    const cacheKey = `${movieId}-${subtitleId}-${fileName}`;

    if (this.requestedFiles.has(cacheKey)) {
      while (
        this.ongoingRequests.has(cacheKey) ||
        !this.inMemoryCache.has(cacheKey)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return this.inMemoryCache.get(cacheKey) || null;
    }

    this.requestedFiles.add(cacheKey);

    try {
      if (this.inMemoryCache.has(cacheKey))
        return this.inMemoryCache.get(cacheKey)!;
      if (this.ongoingRequests.has(cacheKey))
        return this.ongoingRequests.get(cacheKey)!;

      const cachedAudio = await this.audioCache.getAudio(cacheKey);
      if (cachedAudio) {
        try {
          const buffer = await this.audioContext.decodeAudioData(cachedAudio);
          this.inMemoryCache.set(cacheKey, buffer);
          return buffer;
        } catch (e) {
          console.error("Error decoding cached audio data:", e);
        }
      }

      const request = this.fetchAndProcessAudio(
        movieId,
        subtitleId,
        fileName,
        cacheKey
      );
      this.ongoingRequests.set(cacheKey, request);
      return await request;
    } finally {
      this.ongoingRequests.delete(cacheKey);
    }
  }

  private async fetchAndProcessAudio(
    movieId: string,
    subtitleId: string,
    fileName: string,
    cacheKey: string
  ): Promise<AudioBuffer | null> {
    try {
      const audioData = await this.fetchAudioFile(
        movieId,
        subtitleId,
        fileName
      );
      if (!audioData) return null;

      const buffer = await this.audioContext.decodeAudioData(audioData);
      this.inMemoryCache.set(cacheKey, buffer);
      await this.audioCache.storeAudio(cacheKey, audioData);
      return buffer;
    } catch (e) {
      console.error("Error fetching or processing audio:", e);
      return null;
    }
  }

  private fetchAudioFile(
    movieId: string,
    subtitleId: string,
    fileName: string
  ): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "requestAudioFile", movieId, subtitleId, fileName },
        (response: any) => {
          if (response?.action === "audioFileData" && response.data) {
            resolve(base64ToArrayBuffer(response.data));
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  clearCache(): void {
    this.inMemoryCache.clear();
    this.ongoingRequests.clear();
    this.requestedFiles.clear();
  }
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
    request.onerror = (event) => log(LogLevel.ERROR, "IndexedDB error:", event);
    request.onsuccess = (event) =>
      (this.db = (event.target as IDBOpenDBRequest).result);
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

      request.onsuccess = () =>
        resolve(request.result ? request.result.audioData : null);
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
    return this.sortedSubtitles.filter((subtitle) => {
      const startTime = timeStringToSeconds(subtitle.start);
      return startTime > currentTime && startTime <= currentTime + preloadTime;
    });
  }

  reset(): void {
    this.sortedSubtitles = [];
  }

  async getSubtitles(
    movieId: string,
    subtitleId: string
  ): Promise<Subtitle[] | null> {
    const cacheKey = `${movieId}-${subtitleId}`;

    if (this.subtitlesCache.has(cacheKey))
      return this.subtitlesCache.get(cacheKey)!;

    if (!this.subtitleRequests.has(cacheKey)) {
      const subtitlePromise = new Promise<Subtitle[] | null>((resolve) => {
        chrome.runtime.sendMessage(
          { action: "requestSubtitles", movieId, subtitleId },
          (response: any) => {
            if (response?.action === "subtitlesData") {
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

    const subtitlePromise = this.subtitleRequests.get(cacheKey);
    this.subtitleRequests.delete(cacheKey);

    // Wait for the promise to resolve and return its result
    return subtitlePromise ? await subtitlePromise : null;
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

    return this.sortedSubtitles
      .slice(index)
      .filter(
        (subtitle) =>
          timeStringToSeconds(subtitle.start) <= currentTime &&
          timeStringToSeconds(subtitle.end) > currentTime
      );
  }
}

class AudioPlayer {
  private activeAudio: Map<
    string,
    { source: AudioBufferSourceNode; subtitle: Subtitle }
  > = new Map();

  constructor(private audioContext: AudioContext) {}

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
    source.onended = () => this.activeAudio.delete(fileName);
  }

  stopAudio(fileName: string): void {
    const audioInfo = this.activeAudio.get(fileName);
    if (audioInfo) {
      audioInfo.source.stop();
      this.activeAudio.delete(fileName);
    }
  }

  stopAllAudio(): void {
    this.activeAudio.forEach((_, fileName) => this.stopAudio(fileName));
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

  setVolume(volume: number): void {
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
}

class DubbingManager {
  private audioFileManager: AudioFileManager;
  private subtitleManager: SubtitleManager;
  private audioPlayer: AudioPlayer;
  private audioContext: AudioContext;
  private originalVolume = 1;
  private currentMovieId: string | null = null;
  private currentSubtitleId: string | null = null;
  private isVideoPaused = false;
  private lastSentSubtitle: Subtitle | null = null;
  private lastSentTime: number = 0;
  private preloadTime = 5;

  constructor() {
    this.audioContext = new window.AudioContext();
    this.audioFileManager = new AudioFileManager(this.audioContext);
    this.subtitleManager = new SubtitleManager();
    this.audioPlayer = new AudioPlayer(this.audioContext);
    this.setupMessageListener();
    this.checkAndApplyDubbing();
  }

  stopDubbing(): void {
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

  private async getAudioBuffer(fileName: string): Promise<AudioBuffer | null> {
    return this.audioFileManager.getAudioBuffer(
      this.currentMovieId!,
      this.currentSubtitleId!,
      fileName
    );
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (message: { action: string; movieId?: string; subtitleId?: string }) => {
        if (
          message.action === "applyDubbing" &&
          message.movieId &&
          message.subtitleId
        ) {
          this.handleApplyDubbing(message.movieId, message.subtitleId);
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
        movieState?.isDubbingActive &&
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
      log(
        LogLevel.ERROR,
        `Error applying dubbing: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
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
    const currentTime = video.currentTime;
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(currentTime);

    this.adjustVolume(video, currentSubtitles);
    if (!this.isVideoPaused) {
      this.playCurrentSubtitles(currentTime);
    }
    this.audioPlayer.stopExpiredAudio(currentTime);
    this.preloadUpcomingSubtitles(currentTime);

    this.sendCurrentSubtitleInfo(currentTime, currentSubtitles);
  };

  private adjustVolume(
    video: HTMLVideoElement,
    currentSubtitles: Subtitle[]
  ): void {
    video.volume = currentSubtitles.length > 0 ? 0.3 : this.originalVolume;
  }

  private playCurrentSubtitles(currentTime: number): void {
    const currentSubtitles =
      this.subtitleManager.getCurrentSubtitles(currentTime);
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
      this.getAudioBuffer(audioFileName); // This will cache the audio if it's not already cached
    });
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

  private sendCurrentSubtitleInfo(
    currentTime: number,
    currentSubtitles: Subtitle[]
  ): void {
    if (currentSubtitles.length > 0) {
      const currentSubtitle = currentSubtitles[0];
      const startTime = timeStringToSeconds(currentSubtitle.start);
      const endTime = timeStringToSeconds(currentSubtitle.end);

      if (
        currentSubtitle !== this.lastSentSubtitle ||
        currentTime - this.lastSentTime >= 0.5
      ) {
        chrome.runtime.sendMessage({
          action: "currentSubtitle",
          subtitle: {
            text: currentSubtitle.text,
            start: startTime,
            end: endTime,
            currentTime,
          },
        });

        this.lastSentSubtitle = currentSubtitle;
        this.lastSentTime = currentTime;
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
    for (const iframe of iframes) {
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

const dubbingManager = new DubbingManager();
