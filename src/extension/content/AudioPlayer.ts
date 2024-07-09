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
    fileName: string,
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    // Ensure offset is not negative and not beyond the buffer duration
    const startOffset = Math.max(0, Math.min(offset, buffer.duration));
    source.start(0, startOffset);

    this.activeAudio.set(fileName, { source, subtitle });
    source.onended = () => this.activeAudio.delete(fileName);
  }

  stopExpiredAudio(adjustedTime: number): void {
    this.activeAudio.forEach((audioInfo, fileName) => {
      const endTime = timeStringToSeconds(audioInfo.subtitle.end);
      if (adjustedTime >= endTime) {
        this.stopAudio(fileName);
      }
    });
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
