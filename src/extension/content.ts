// @ts-ignore

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
  return `${subtitle.start
    .replace(/,/g, ".")
    .replace(/:/g, "_")}__${subtitle.end
    .replace(/,/g, ".")
    .replace(/:/g, "_")}.mp3`;
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
  private currentLanguage: string | null = null;

  constructor() {
    this.audioContext = new window.AudioContext();
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
      ) => {
        if (message.action === "applyDubbing") {
          this.handleApplyDubbing(message.movieId, message.language);
        }
      }
    );
  }

  private handleApplyDubbing(movieId: string, language: string): void {
    this.currentMovieId = movieId;
    this.currentLanguage = language;
    chrome.runtime.sendMessage(
      {
        action: "requestSubtitles",
        movieId: this.currentMovieId,
        language: this.currentLanguage,
      },
      (response: any) => {
        if (response && response.action === "subtitlesData") {
          this.subtitlesData = response.data;
          this.findAndHandleVideo();
        }
      }
    );
  }

  private handleVideo(video: HTMLVideoElement): void {
    console.log("found video tag");
    this.originalVolume = video.volume;

    video.addEventListener("play", () => console.log("Video played"));
    video.addEventListener("pause", () => console.log("Video paused"));
    video.addEventListener("volumechange", () =>
      this.handleVolumeChange(video)
    );
    video.addEventListener("timeupdate", () => this.handleTimeUpdate(video));
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
      this.playCurrentSubtitles(currentTime, currentSubtitles);
      this.stopExpiredAudio(currentTime);
      this.preloadUpcomingSubtitles(currentTime);
    }
  }

  private getCurrentSubtitles(currentTime: number): Subtitle[] {
    return this.subtitlesData!.filter((subtitle) => {
      const startTime = timeStringToSeconds(subtitle.start);
      const endTime = timeStringToSeconds(subtitle.end);
      return currentTime >= startTime && currentTime < endTime;
    });
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

      if (
        Math.abs(currentTime - startTime) < 0.3 &&
        !this.activeAudio.has(audioFileName)
      ) {
        this.playAudioIfAvailable(audioFileName, subtitle);
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

  private preloadAudio(fileName: string): void {
    if (this.preloadedAudio.has(fileName)) return;

    chrome.runtime.sendMessage(
      {
        action: "requestAudioFile",
        movieId: this.currentMovieId,
        language: this.currentLanguage,
        fileName: fileName,
      },
      (response: any) => {
        if (response && response.action === "audioFileData") {
          const audioData = base64ToArrayBuffer(response.data);
          this.audioContext
            .decodeAudioData(audioData)
            .then((buffer) => {
              this.preloadedAudio.set(fileName, buffer);
            })
            .catch((e) => console.error("Error decoding audio data:", e));
        }
      }
    );
  }

  private playAudioIfAvailable(fileName: string, subtitle: Subtitle): void {
    if (this.preloadedAudio.has(fileName)) {
      const buffer = this.preloadedAudio.get(fileName);
      if (buffer) this.playAudioBuffer(buffer, fileName, subtitle);
    } else {
      console.log(`Audio file ${fileName} not preloaded, fetching now...`);
      this.fetchAndPlayAudio(fileName, subtitle);
    }
  }

  private fetchAndPlayAudio(fileName: string, subtitle: Subtitle): void {
    chrome.runtime.sendMessage(
      {
        action: "requestAudioFile",
        movieId: this.currentMovieId,
        language: this.currentLanguage,
        fileName: fileName,
      },
      (response: any) => {
        if (response && response.action === "audioFileData") {
          const audioData = base64ToArrayBuffer(response.data);
          this.audioContext.decodeAudioData(audioData).then((buffer) => {
            this.playAudioBuffer(buffer, fileName, subtitle);
          });
        }
      }
    );
  }

  private playAudioBuffer(
    buffer: AudioBuffer,
    fileName: string,
    subtitle: Subtitle
  ): void {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();

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
  }
}

// Initialize the DubbingManager
const dubbingManager = new DubbingManager();
