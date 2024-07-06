export enum LogLevel {
  INFO,
  WARN,
  ERROR,
}

export function log(level: LogLevel, message: string, ...args: any[]): void {
  const prefix = LogLevel[level];
  console[
    level === LogLevel.ERROR
      ? "error"
      : level === LogLevel.WARN
      ? "warn"
      : "log"
  ](`[${prefix}]`, message, ...args);
}

export function timeStringToSeconds(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":");
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseFloat(seconds.replace(",", "."))
  );
}

export function getAudioFileName(subtitle: {
  start: string;
  end: string;
}): string {
  const startMs = timeStringToMilliseconds(subtitle.start);
  const endMs = timeStringToMilliseconds(subtitle.end);
  return `${startMs}-${endMs}.mp3`;
}

export function timeStringToMilliseconds(timeString: string): number {
  const [hours, minutes, seconds] = timeString.split(":");
  const [secs, ms] = seconds.split(",");
  return (
    parseInt(hours) * 3600000 +
    parseInt(minutes) * 60000 +
    parseInt(secs) * 1000 +
    parseInt(ms)
  );
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
