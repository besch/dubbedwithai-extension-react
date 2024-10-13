import { VideoManager } from "./VideoManager";
import { SubtitleManager } from "./SubtitleManager";
import { Subtitle } from "@/types";

export class SubtitleAligner {
  private videoManager: VideoManager;
  private subtitleManager: SubtitleManager;
  private isCancelled: boolean = false;
  private languageCode: string;

  constructor(videoManager: VideoManager, languageCode: string) {
    this.videoManager = videoManager;
    this.subtitleManager = SubtitleManager.getInstance();
    this.languageCode = languageCode;
  }

  public async alignSubtitles(): Promise<number | null> {
    this.isCancelled = false;
    const alignResult = await this.extractAndAlign();
    if (alignResult) {
      const { offset } = alignResult;
      return offset;
    } else {
      return null;
    }
  }

  private async extractAndAlign(): Promise<{ offset: number } | null> {
    const audioContext = this.videoManager.getAudioContext();
    const audioSourceNode = this.videoManager.getAudioSourceNode();
    const videoElement = this.videoManager.getVideoElement();

    if (!audioContext || !audioSourceNode || !videoElement) {
      console.error(
        "Audio context, source node, or video element not available",
        audioContext,
        audioSourceNode,
        videoElement
      );
      return null;
    }

    const destination = audioContext.createMediaStreamDestination();

    // Connect the audioSourceNode to the destination
    audioSourceNode.connect(destination);

    const mediaRecorder = new MediaRecorder(destination.stream);

    return new Promise((resolve, reject) => {
      let chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          // Disconnect after recording
          audioSourceNode.disconnect(destination);

          if (this.isCancelled) {
            reject(new Error("Alignment cancelled"));
            return;
          }

          const blob = new Blob(chunks, { type: "audio/webm" });
          const arrayBuffer = await blob.arrayBuffer();
          const base64Audio = this.arrayBufferToBase64(arrayBuffer);

          const recognizedText = await this.sendAudioForRecognition(
            base64Audio
          );
          const offset = this.calculateOffset(recognizedText);
          console.warn("offset", offset);
          resolve({ offset });
        } catch (error) {
          reject(error);
        }
      };

      // Record 3 seconds of audio
      mediaRecorder.start();
      videoElement.play(); // Ensure the video is playing during recording

      setTimeout(() => {
        if (!this.isCancelled) {
          mediaRecorder.stop();
        } else {
          mediaRecorder.stop();
          reject(new Error("Alignment cancelled"));
        }
      }, 3000);
    });
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private async sendAudioForRecognition(base64Audio: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "recognizeSpeech",
          audioData: base64Audio,
          languageCode: this.languageCode,
        },
        (response) => {
          if (response && response.success) {
            resolve(response.translatedTranscript);
          } else {
            reject(response.error || "Speech recognition failed");
          }
        }
      );
    });
  }

  private calculateOffset(recognizedText: string): number {
    const subtitles = this.subtitleManager.getActiveSubtitles();
    let bestMatch: { subtitle: Subtitle; similarity: number } | null = null;

    for (const subtitle of subtitles) {
      const similarity = this.compareText(subtitle.text, recognizedText);
      if (similarity > 0.4) {
        // Adjusted threshold
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { subtitle, similarity };
        }
      }
    }

    if (bestMatch) {
      const videoCurrentTime = this.videoManager.getCurrentVideoTimeMs();
      const offset = videoCurrentTime - bestMatch.subtitle.start;
      return offset;
    } else {
      throw new Error("No matching subtitle found");
    }
  }

  private compareText(text1: string, text2: string): number {
    // Normalize the texts: convert to lowercase and remove punctuation
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]|_/g, "")
        .replace(/\s+/g, " ");
    const normalizedText1 = normalize(text1);
    const normalizedText2 = normalize(text2);

    // Calculate Levenshtein distance
    const levenshteinDistance = (a: string, b: string): number => {
      if (a.length === 0) return b.length;
      if (b.length === 0) return a.length;

      const matrix = [];

      // Increment along the first column of each row
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }

      // Increment each column in the first row
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }

      // Fill in the rest of the matrix
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1, // substitution
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1 // deletion
            );
          }
        }
      }

      return matrix[b.length][a.length];
    };

    const distance = levenshteinDistance(normalizedText1, normalizedText2);
    const maxLength = Math.max(normalizedText1.length, normalizedText2.length);

    // Calculate similarity as a value between 0 and 1
    const similarity = 1 - distance / maxLength;

    return similarity;
  }

  public cancelAlignment(): void {
    this.isCancelled = true;
  }
}
