import { Subtitle } from "./types";

export class AudioPlayer {
  private dubbingVolumeMultiplier: number = 1.0;
  private static instance: AudioPlayer | null = null;
  private activeAudio: Map<
    string,
    { source: AudioBufferSourceNode; subtitle: Subtitle; gainNode: GainNode }
  > = new Map();
  private recentlyPlayedAudio: Map<string, number> = new Map();
  private readonly REPLAY_THRESHOLD_MS: number = 500; // Minimum time between replays

  constructor(private audioContext: AudioContext) {}

  public static getInstance(audioContext: AudioContext): AudioPlayer {
    if (!AudioPlayer.instance) {
      AudioPlayer.instance = new AudioPlayer(audioContext);
    }
    return AudioPlayer.instance;
  }

  setDubbingVolumeMultiplier(multiplier: number): void {
    this.dubbingVolumeMultiplier = multiplier;
    this.updateAllAudioVolumes();
  }

  private updateAllAudioVolumes(): void {
    this.activeAudio.forEach((audioInfo) => {
      audioInfo.gainNode.gain.setValueAtTime(
        this.dubbingVolumeMultiplier,
        this.audioContext.currentTime
      );
    });
  }

  async playAudio(
    buffer: AudioBuffer,
    filePath: string,
    subtitle: Subtitle,
    offset: number = 0,
    playbackRate: number = 1
  ): Promise<void> {
    const now = this.audioContext.currentTime;
    const lastPlayedTime = this.recentlyPlayedAudio.get(filePath) || 0;

    if (now - lastPlayedTime < this.REPLAY_THRESHOLD_MS / 1000) {
      console.log(`Skipping playback of ${filePath}: Too soon since last play`);
      return;
    }

    this.stopAudio(filePath);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(
      this.dubbingVolumeMultiplier,
      this.audioContext.currentTime
    );

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const startOffset = Math.max(0, Math.min(offset, buffer.duration));
    source.start(0, startOffset);

    this.activeAudio.set(filePath, { source, subtitle, gainNode });
    this.recentlyPlayedAudio.set(filePath, now);

    source.onended = () => {
      this.activeAudio.delete(filePath);
    };
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
    this.recentlyPlayedAudio.clear();
  }

  isAudioActive(filePath: string): boolean {
    return this.activeAudio.has(filePath);
  }

  setVolume(volume: number): void {
    this.activeAudio.forEach((audioInfo) => {
      audioInfo.gainNode.gain.setValueAtTime(
        volume,
        this.audioContext.currentTime
      );
    });
  }

  getCurrentlyPlayingSubtitles(): Subtitle[] {
    return Array.from(this.activeAudio.values()).map(
      (audioInfo) => audioInfo.subtitle
    );
  }

  clearRecentlyPlayedAudio(): void {
    const now = this.audioContext.currentTime;
    const entriesToDelete: string[] = [];

    this.recentlyPlayedAudio.forEach((lastPlayedTime, filePath) => {
      if (now - lastPlayedTime >= this.REPLAY_THRESHOLD_MS / 1000) {
        entriesToDelete.push(filePath);
      }
    });

    entriesToDelete.forEach((filePath) => {
      this.recentlyPlayedAudio.delete(filePath);
    });
  }
}
