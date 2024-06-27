// @ts-ignore
(() => {
  let subtitlesData: Array<{
    start: string;
    end: string;
    text: string;
  }> | null = null;
  const audioContext = new window.AudioContext();
  const preloadTime = 5;
  const preloadedAudio: Map<string, AudioBuffer> = new Map();
  const activeAudio: Map<
    string,
    {
      source: AudioBufferSourceNode;
      subtitle: { start: string; end: string; text: string };
    }
  > = new Map();
  let originalVolume = 1;
  let currentMovieId: string | null = null;
  let currentLanguage: string | null = null;

  chrome.runtime.onMessage.addListener(
    (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if (message.action === "applyDubbing") {
        currentMovieId = message.movieId;
        currentLanguage = message.language;
        chrome.runtime.sendMessage(
          {
            action: "requestSubtitles",
            movieId: currentMovieId,
            language: currentLanguage,
          },
          (response: any) => {
            if (response && response.action === "subtitlesData") {
              subtitlesData = response.data;
              findAndHandleVideo();
            }
          }
        );
      }
    }
  );

  function handleVideo(video: HTMLVideoElement): void {
    console.log("found video tag");
    originalVolume = video.volume;

    video.addEventListener("play", () => console.log("Video played"));
    video.addEventListener("pause", () => console.log("Video paused"));
    video.addEventListener("volumechange", () => {
      if (
        !subtitlesData ||
        subtitlesData.every(
          (subtitle) =>
            video.currentTime < timeStringToSeconds(subtitle.start) ||
            video.currentTime >= timeStringToSeconds(subtitle.end)
        )
      ) {
        originalVolume = video.volume;
      }
    });

    video.addEventListener("timeupdate", () => {
      const currentTime = video.currentTime;
      if (subtitlesData) {
        const currentSubtitles = subtitlesData.filter((subtitle) => {
          const startTime = timeStringToSeconds(subtitle.start);
          const endTime = timeStringToSeconds(subtitle.end);
          return currentTime >= startTime && currentTime < endTime;
        });

        if (currentSubtitles.length > 0) {
          if (video.volume !== 0.3) {
            video.volume = 0.3;
          }
        } else {
          if (video.volume !== originalVolume) {
            video.volume = originalVolume;
          }
        }

        currentSubtitles.forEach((subtitle) => {
          const audioFileName = getAudioFileName(subtitle);
          const startTime = timeStringToSeconds(subtitle.start);

          if (
            Math.abs(currentTime - startTime) < 0.3 &&
            !activeAudio.has(audioFileName)
          ) {
            playAudioIfAvailable(audioFileName, subtitle);
          }
        });

        activeAudio.forEach((audioInfo, fileName) => {
          if (currentTime >= timeStringToSeconds(audioInfo.subtitle.end)) {
            stopAudio(fileName);
          }
        });

        const upcomingSubtitles = subtitlesData.filter((subtitle) => {
          const startTime = timeStringToSeconds(subtitle.start);
          return (
            startTime > currentTime && startTime <= currentTime + preloadTime
          );
        });

        upcomingSubtitles.forEach((subtitle) => {
          const audioFileName = getAudioFileName(subtitle);
          if (!preloadedAudio.has(audioFileName)) {
            preloadAudio(audioFileName);
          }
        });
      }
    });
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

  function preloadAudio(fileName: string): void {
    if (preloadedAudio.has(fileName)) return;

    chrome.runtime.sendMessage(
      {
        action: "requestAudioFile",
        movieId: currentMovieId,
        language: currentLanguage,
        fileName: fileName,
      },
      (response: any) => {
        if (response && response.action === "audioFileData") {
          const audioData = base64ToArrayBuffer(response.data);
          audioContext
            .decodeAudioData(audioData)
            .then((buffer) => {
              preloadedAudio.set(fileName, buffer);
            })
            .catch((e) => console.error("Error decoding audio data:", e));
        }
      }
    );
  }

  function playAudioIfAvailable(
    fileName: string,
    subtitle: { start: string; end: string; text: string }
  ): void {
    if (preloadedAudio.has(fileName)) {
      const buffer = preloadedAudio.get(fileName);
      if (buffer) playAudioBuffer(buffer, fileName, subtitle);
    } else {
      console.log(`Audio file ${fileName} not preloaded, fetching now...`);
      chrome.runtime.sendMessage(
        {
          action: "requestAudioFile",
          movieId: currentMovieId,
          language: currentLanguage,
          fileName: fileName,
        },
        (response: any) => {
          if (response && response.action === "audioFileData") {
            const audioData = base64ToArrayBuffer(response.data);
            audioContext.decodeAudioData(audioData).then((buffer) => {
              playAudioBuffer(buffer, fileName, subtitle);
            });
          }
        }
      );
    }
  }

  function playAudioBuffer(
    buffer: AudioBuffer,
    fileName: string,
    subtitle: { start: string; end: string; text: string }
  ): void {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();

    activeAudio.set(fileName, { source, subtitle });

    source.onended = () => {
      activeAudio.delete(fileName);
    };
  }

  function stopAudio(fileName: string): void {
    if (activeAudio.has(fileName)) {
      const audioInfo = activeAudio.get(fileName);
      if (audioInfo) {
        audioInfo.source.stop();
        activeAudio.delete(fileName);
      }
    }
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

  function findAndHandleVideo(): void {
    let video = document.querySelector("video");

    if (video) {
      handleVideo(video);
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
            handleVideo(video);
            return;
          }
        }
      } catch (e) {
        console.error("Could not access iframe content:", e);
      }
    }
  }
})();
