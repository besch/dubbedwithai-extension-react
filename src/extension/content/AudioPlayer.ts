import { Subtitle } from "@/types";

export class AudioPlayer {
  private dubbingVolumeMultiplier: number = 1.0;
  private activeAudio: Map<
    string,
    {
      source: AudioBufferSourceNode | null;
      subtitle: Subtitle;
      gainNode: GainNode;
      startTime: number;
      offset: number;
      isFadingOut?: boolean;
    }
  > = new Map();
  constructor(private audioContext: AudioContext) {}

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

    // Silent buffer is used to overcome webaudio bug that causes audio sounds like it is cut at the beginning
    const silentDuration = 0.2; // Adjust this value as needed

    // Create a silent buffer
    const silentBuffer = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      this.audioContext.sampleRate * silentDuration,
      this.audioContext.sampleRate
    );

    // Create a new buffer that combines silence and original audio
    const combinedBuffer = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      silentBuffer.length + buffer.length,
      this.audioContext.sampleRate
    );

    // Copy silent buffer first
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const combinedChannelData = combinedBuffer.getChannelData(channel);
      combinedChannelData.set(silentBuffer.getChannelData(channel), 0);
      combinedChannelData.set(
        buffer.getChannelData(channel),
        silentBuffer.length
      );
    }

    // Ensure the audio context is running
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // Get current time after resuming
    const currentTime = this.audioContext.currentTime;

    const source = this.audioContext.createBufferSource();
    source.buffer = combinedBuffer; // Use the combined buffer instead of the original

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(this.dubbingVolumeMultiplier, currentTime);

    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Adjust the offset to account for the silent duration
    const startOffset = Math.max(0, Math.min(offset, buffer.duration));
    const adjustedOffset = startOffset + silentDuration;

    source.start(currentTime, adjustedOffset);

    this.activeAudio.set(filePath, {
      source,
      subtitle,
      gainNode,
      startTime: currentTime,
      offset: startOffset,
    });

    source.onended = () => {
      this.activeAudio.delete(filePath);
    };
  }

  fadeOutExpiredAudio(adjustedTime: number): void {
    this.activeAudio.forEach((audioInfo, filePath) => {
      if (adjustedTime >= audioInfo.subtitle.end) {
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
