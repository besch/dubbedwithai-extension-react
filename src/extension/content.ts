interface Subtitle {
  start: string;
  end: string;
  text: string;
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

class DubbingManager {
  private subtitlesCache: Map<string, Subtitle[]> = new Map();
  private audioRequests: Map<string, Promise<AudioBuffer | null>> = new Map();
  private subtitleRequests: Map<string, Promise<Subtitle[] | null>> = new Map();
  private dbName = "AudioCache";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private subtitlesData: Subtitle[] | null = null;
  private audioContext: AudioContext;
  private preloadTime = 5;
  private preloadedAudio: Map<string, AudioBuffer> = new Map();
  private activeAudio: Map<
    string,
    { source: AudioBufferSourceNode; subtitle: Subtitle }
  > = new Map();
  private originalVolume = 1;
  private currentMovieId: string | null = null;
  private currentSubtitleId: string | null = null;
  private isVideoPaused = false;
  private lastSentSubtitle: Subtitle | null = null;
  private lastSentTime: number = 0;

  constructor() {
    this.audioContext = new window.AudioContext();
    this.setupMessageListener();
    this.checkAndApplyDubbing();
    this.initIndexedDB();
  }

  private async getSubtitles(
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

  private async getAudioBuffer(fileName: string): Promise<AudioBuffer | null> {
    const preloadedBuffer = this.preloadedAudio.get(fileName);
    if (preloadedBuffer) return preloadedBuffer;

    if (!this.audioRequests.has(fileName)) {
      const audioPromise = this.fetchAudioBuffer(fileName);
      this.audioRequests.set(fileName, audioPromise);
    }

    const audioBuffer = await this.audioRequests.get(fileName);
    this.audioRequests.delete(fileName);
    return audioBuffer || null;
  }

  private async fetchAudioBuffer(
    fileName: string
  ): Promise<AudioBuffer | null> {
    // Try to get audio from IndexedDB first
    const cachedAudio = await this.getAudioFromIndexedDB(fileName);
    if (cachedAudio) {
      try {
        const buffer = await this.audioContext.decodeAudioData(cachedAudio);
        this.preloadedAudio.set(fileName, buffer);
        return buffer;
      } catch (e) {
        console.error("Error decoding cached audio data:", e);
      }
    }

    // If not in IndexedDB, fetch from server
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
              // Store in IndexedDB for future use
              await this.storeAudioInIndexedDB(fileName, audioData);
              resolve(buffer);
            } catch (e) {
              console.error("Error decoding audio data:", e);
              resolve(null);
            }
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  private initIndexedDB(): void {
    const request = indexedDB.open(this.dbName, this.dbVersion);

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore("audioFiles", { keyPath: "fileName" });
    };
  }

  private async getAudioFromIndexedDB(
    fileName: string
  ): Promise<ArrayBuffer | null> {
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
        console.error("Error fetching audio from IndexedDB:", request.error);
        resolve(null);
      };
    });
  }

  private async storeAudioInIndexedDB(
    fileName: string,
    audioData: ArrayBuffer
  ): Promise<void> {
    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["audioFiles"], "readwrite");
      const store = transaction.objectStore("audioFiles");
      const request = store.put({ fileName, audioData });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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
      this.subtitlesData = await this.getSubtitles(movieId, subtitleId);
      if (this.subtitlesData) {
        this.findAndHandleVideo();
      } else {
        throw new Error(
          `Failed to load subtitles for movie ${movieId} and subtitle ${subtitleId}`
        );
      }
    } catch (error) {
      console.error(error);
      // Handle the error case, maybe notify the user or try again
    }
  }

  public stopDubbing(): void {
    this.subtitlesData = null;
    this.stopAllAudio();
    this.preloadedAudio.clear();

    // Restore original volume
    const video = document.querySelector("video");
    if (video) {
      video.volume = this.originalVolume;
    }
  }

  private handleVideo(video: HTMLVideoElement): void {
    console.log("found video tag");
    this.originalVolume = video.volume;

    const eventHandlers = {
      play: () => this.handleVideoPlay(video),
      pause: () => this.handleVideoPause(),
      seeking: () => this.handleVideoSeeking(video),
      volumechange: () => this.handleVolumeChange(video),
      timeupdate: () => this.handleTimeUpdate(video),
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
    if (
      !this.subtitlesData ||
      this.subtitlesData.every(
        (subtitle) =>
          video.currentTime < timeStringToSeconds(subtitle.start) ||
          video.currentTime >= timeStringToSeconds(subtitle.end)
      )
    ) {
      this.originalVolume = video.volume;
    }
  }

  private handleTimeUpdate(video: HTMLVideoElement): void {
    const currentTime = video.currentTime;
    if (this.subtitlesData) {
      const currentSubtitles = this.getCurrentSubtitles(currentTime);
      this.adjustVolume(video, currentSubtitles);
      if (!this.isVideoPaused) {
        this.playCurrentSubtitles(currentTime, currentSubtitles);
      }
      this.stopExpiredAudio(currentTime);
      this.preloadUpcomingSubtitles(currentTime);

      // Send current subtitle info to the extension, but only if it's changed or enough time has passed
      if (currentSubtitles.length > 0) {
        const currentSubtitle = currentSubtitles[0];
        const startTime = timeStringToSeconds(currentSubtitle.start);
        const endTime = timeStringToSeconds(currentSubtitle.end);

        // Only send a message if the subtitle has changed or 0.5 seconds have passed
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
          console.log("Sending subtitle message:", message);
          chrome.runtime.sendMessage(message);

          this.lastSentSubtitle = currentSubtitle;
          this.lastSentTime = currentTime;
        }
      } else if (this.lastSentSubtitle !== null) {
        // If there's no current subtitle but we had one before, send a null message
        chrome.runtime.sendMessage({
          action: "currentSubtitle",
          subtitle: null,
        });
        this.lastSentSubtitle = null;
      }
    }
  }

  private getCurrentSubtitles(currentTime: number): Subtitle[] {
    return (
      this.subtitlesData?.filter((subtitle) => {
        const startTime = timeStringToSeconds(subtitle.start);
        const endTime = timeStringToSeconds(subtitle.end);
        return currentTime >= startTime && currentTime < endTime;
      }) || []
    );
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
        !this.activeAudio.has(audioFileName)
      ) {
        this.playAudioIfAvailable(
          audioFileName,
          subtitle,
          currentTime - startTime
        );
      }
    });
  }

  private stopExpiredAudio(currentTime: number): void {
    this.activeAudio.forEach((audioInfo, fileName) => {
      if (currentTime >= timeStringToSeconds(audioInfo.subtitle.end)) {
        this.stopAudio(fileName);
      }
    });
  }

  private preloadUpcomingSubtitles(currentTime: number): void {
    const upcomingSubtitles = this.subtitlesData!.filter((subtitle) => {
      const startTime = timeStringToSeconds(subtitle.start);
      return (
        startTime > currentTime && startTime <= currentTime + this.preloadTime
      );
    });

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
      this.playAudioBuffer(buffer, fileName, subtitle, offset);
    } else {
      console.warn(`Audio buffer not available for file: ${fileName}`);
    }
  }

  private playAudioBuffer(
    buffer: AudioBuffer,
    fileName: string,
    subtitle: Subtitle,
    offset: number = 0
  ): void {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    if (!this.isVideoPaused) {
      source.start(0, offset);
    }

    this.activeAudio.set(fileName, { source, subtitle });

    source.onended = () => {
      this.activeAudio.delete(fileName);
    };
  }

  private stopAudio(fileName: string): void {
    if (this.activeAudio.has(fileName)) {
      const audioInfo = this.activeAudio.get(fileName);
      if (audioInfo) {
        audioInfo.source.stop();
        this.activeAudio.delete(fileName);
      }
    }
  }

  private stopAllAudio(): void {
    this.activeAudio.forEach((audioInfo, fileName) => {
      this.stopAudio(fileName);
    });
    this.activeAudio.clear();
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
