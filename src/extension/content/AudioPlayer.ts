import { Subtitle } from "@/types";
import config from "./config";

export class AudioPlayer {
  private dubbingVolumeMultiplier: number = 1.0;
  private static instance: AudioPlayer | null = null;
  private activeAudio: Map<
    string,
    {
      source: AudioBufferSourceNode | null;
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
      const { source, startTime } = audioInfo;
      if (source) {
        const elapsedTime = this.audioContext.currentTime - startTime;
        source.stop();
        audioInfo.offset += elapsedTime;
        this.activeAudio.set(filePath, { ...audioInfo, source: null });
      }
    });
  }

  public resumeAllAudio(): void {
    const audioToResume = new Map(this.activeAudio);
    this.activeAudio.clear();
    audioToResume.forEach((audioInfo, filePath) => {
      const { subtitle, offset } = audioInfo;
      const buffer = audioInfo.source?.buffer;
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
    if (existingAudio && existingAudio.source) {
      existingAudio.source.stop();
      this.activeAudio.delete(filePath);
    }

    // Ensure the audio context is running
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Get current time after resuming
    const currentTime = this.audioContext.currentTime;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.audioContext.createGain();

    // Schedule the audio to start slightly in the future
    const scheduledStartTime = currentTime + 0.05;

    // Set the gain to 0 at the scheduled start time
    gainNode.gain.setValueAtTime(0, scheduledStartTime);

    // Schedule the gain to ramp up immediately after the audio starts
    gainNode.gain.linearRampToValueAtTime(
      this.dubbingVolumeMultiplier,
      scheduledStartTime + 0.02
    );

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    const startOffset = Math.max(0, Math.min(offset, buffer.duration));

    // Start the audio source at the scheduled start time
    source.start(scheduledStartTime, startOffset);

    this.activeAudio.set(filePath, {
      source,
      subtitle,
      gainNode,
      startTime: scheduledStartTime,
      offset: startOffset,
    });

    source.onended = () => {
      this.activeAudio.delete(filePath);
    };
  }

  fadeOutExpiredAudio(adjustedTime: number): void {
    this.activeAudio.forEach((audioInfo, filePath) => {
      if (adjustedTime >= audioInfo.subtitle.end) {
        // Stop the audio immediately when the subtitle ends
        if (audioInfo.source) {
          audioInfo.source.stop();
        }
        this.activeAudio.delete(filePath);
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
