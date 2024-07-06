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
