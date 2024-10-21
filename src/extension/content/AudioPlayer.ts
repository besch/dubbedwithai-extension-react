import { Subtitle } from "@/types";
import config from "./config";

export class AudioPlayer {
  private dubbingVolumeMultiplier: number = 1.0;
  private static instance: AudioPlayer | null = null;
  private activeAudio: Map<
    string,
    {
      source: AudioBufferSourceNode;
      subtitle: Subtitle;
      gainNode: GainNode;
      startTime: number;
      offset: number;
    }
  > = new Map();
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

  public pauseAllAudio(): void {
    this.activeAudio.forEach((audioInfo, filePath) => {
      const { source, gainNode, startTime, offset, subtitle } = audioInfo;
      const elapsedTime = this.audioContext.currentTime - startTime;
      source.stop();
      this.activeAudio.set(filePath, {
        source,
        gainNode,
        startTime,
        offset: offset + elapsedTime,
        subtitle,
      });
    });
  }

  public resumeAllAudio(): void {
    const audioToResume = new Map(this.activeAudio);
    this.activeAudio.clear();
    audioToResume.forEach((audioInfo, filePath) => {
      const { subtitle, offset } = audioInfo;
      const buffer = audioInfo.source.buffer;
      if (buffer) {
        this.playAudio(buffer, filePath, subtitle, offset);
      }
    });
  }

  async playAudio(
    buffer: AudioBuffer,
    filePath: string,
    subtitle: Subtitle,
    offset: number = 0
  ): Promise<void> {
    // Stop any existing audio for this file path
    const existingAudio = this.activeAudio.get(filePath);
    if (existingAudio) {
      existingAudio.source.stop();
      this.activeAudio.delete(filePath);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const startOffset = Math.max(0, Math.min(offset, buffer.duration));
    const currentTime = this.audioContext.currentTime;
    const preRollTime = 0.1; // 100ms pre-roll
    const fadeInTime = 0.1; // 100ms fade-in

    // Start the source slightly before the intended start time
    const actualStartOffset = Math.max(0, startOffset - preRollTime);
    source.start(currentTime, actualStartOffset);

    // Schedule the fade-in
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(
      this.dubbingVolumeMultiplier,
      currentTime + fadeInTime
    );

    this.activeAudio.set(filePath, {
      source,
      subtitle,
      gainNode,
      startTime: currentTime,
      offset: actualStartOffset,
    });

    // Schedule the fade-out
    const fadeOutStartTime =
      currentTime +
      (subtitle.end - subtitle.start) / 1000 -
      config.subtitleFadeOutDuration;

    this.fadeOutAudio(gainNode, fadeOutStartTime);

    source.onended = () => {
      this.activeAudio.delete(filePath);
    };
  }

  private fadeOutAudio(
    gainNode: GainNode,
    startTime: number = this.audioContext.currentTime
  ): void {
    const currentVolume = gainNode.gain.value;
    const fadeOutEndTime = startTime + config.subtitleFadeOutDuration;

    gainNode.gain.setValueAtTime(currentVolume, startTime);
    gainNode.gain.linearRampToValueAtTime(
      currentVolume * config.subtitleFadeOutVolume,
      fadeOutEndTime
    );
  }

  fadeOutExpiredAudio(adjustedTime: number): void {
    this.activeAudio.forEach((audioInfo, filePath) => {
      if (
        adjustedTime >=
        audioInfo.subtitle.end + config.subtitleFadeOutDuration * 1000
      ) {
        // Instead of stopping, we'll just keep the volume at the faded-out level
        audioInfo.gainNode.gain.setValueAtTime(
          this.dubbingVolumeMultiplier * config.subtitleFadeOutVolume,
          this.audioContext.currentTime
        );
      }
    });
  }

  isAudioActive(filePath: string): boolean {
    return this.activeAudio.has(filePath);
  }

  getCurrentlyPlayingSubtitles(): Subtitle[] {
    return Array.from(this.activeAudio.values()).map(
      (audioInfo) => audioInfo.subtitle
    );
  }
}
