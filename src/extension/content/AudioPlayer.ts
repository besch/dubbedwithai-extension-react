import { Subtitle } from "./types";

export class AudioPlayer {
  private static instance: AudioPlayer | null = null;
  private activeAudio: Map<
    string,
    { source: AudioBufferSourceNode; subtitle: Subtitle; gainNode: GainNode }
  > = new Map();

  constructor(private audioContext: AudioContext) {}

  public static getInstance(audioContext: AudioContext): AudioPlayer {
    if (!AudioPlayer.instance) {
      AudioPlayer.instance = new AudioPlayer(audioContext);
    }
    return AudioPlayer.instance;
  }

  async playAudio(
    buffer: AudioBuffer,
    filePath: string,
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const startOffset = Math.max(0, Math.min(offset, buffer.duration));
    source.start(0, startOffset);

    this.activeAudio.set(filePath, { source, subtitle, gainNode });
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
      audioInfo.gainNode.disconnect();
      this.activeAudio.delete(filePath);
    }
  }

  stopAllAudio(): void {
    this.activeAudio.forEach((audioInfo, filePath) => {
      audioInfo.source.stop();
      audioInfo.gainNode.disconnect();
      this.activeAudio.delete(filePath);
    });
  }

  isAudioActive(filePath: string): boolean {
    return this.activeAudio.has(filePath);
  }

  setVolume(volume: number): void {
    this.activeAudio.forEach((audioInfo) => {
      audioInfo.gainNode.gain.setValueAtTime(1, this.audioContext.currentTime);
    });
  }

  getCurrentlyPlayingSubtitles(): Subtitle[] {
    return Array.from(this.activeAudio.values()).map(
      (audioInfo) => audioInfo.subtitle
    );
  }
}
