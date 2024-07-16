import { Subtitle } from "./types";
import { timeStringToSeconds } from "./utils";

export class AudioPlayer {
  private activeAudio: Map<
    string,
    { source: AudioBufferSourceNode; subtitle: Subtitle }
  > = new Map();

  constructor(private audioContext: AudioContext) {}

  async playAudio(
    buffer: AudioBuffer,
    filePath: string,
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const startOffset = Math.max(0, Math.min(offset, buffer.duration));
    source.start(0, startOffset);

    this.activeAudio.set(filePath, { source, subtitle });
    source.onended = () => this.activeAudio.delete(filePath);
  }

  stopExpiredAudio(adjustedTime: number): void {
    this.activeAudio.forEach((audioInfo, filePath) => {
      if (adjustedTime >= audioInfo.subtitle.end) {
        this.stopAudio(filePath);
      }
    });
  }

  stopAudio(filePath: string): void {
    const audioInfo = this.activeAudio.get(filePath);
    if (audioInfo) {
      audioInfo.source.stop();
      this.activeAudio.delete(filePath);
    }
  }

  stopAllAudio(): void {
    this.activeAudio.forEach((_, filePath) => this.stopAudio(filePath));
  }

  isAudioActive(filePath: string): boolean {
    return this.activeAudio.has(filePath);
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
