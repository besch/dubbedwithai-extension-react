import { Subtitle } from "@/types";

export function parseSrt(srtContent: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const lines = srtContent.split(/\r?\n/);
  let currentSubtitle: Partial<Subtitle> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (/^\d+$/.test(line)) {
      if (
        currentSubtitle &&
        currentSubtitle.start &&
        currentSubtitle.end &&
        currentSubtitle.text
      ) {
        subtitles.push(currentSubtitle as Subtitle);
      }
      currentSubtitle = {};
    } else if (line.includes(" --> ")) {
      const [startTime, endTime] = line.split(" --> ");
      if (currentSubtitle) {
        currentSubtitle.start = timeStringToMilliseconds(startTime.trim());
        currentSubtitle.end = timeStringToMilliseconds(endTime.trim());
      }
    } else if (line !== "") {
      if (currentSubtitle) {
        currentSubtitle.text = currentSubtitle.text
          ? currentSubtitle.text + "\n" + line
          : line;
      }
    }
  }

  if (
    currentSubtitle &&
    currentSubtitle.start &&
    currentSubtitle.end &&
    currentSubtitle.text
  ) {
    subtitles.push(currentSubtitle as Subtitle);
  }

  return subtitles;
}

export function millisecondsToTimeString(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3600000);
  milliseconds %= 3600000;
  const minutes = Math.floor(milliseconds / 60000);
  milliseconds %= 60000;
  const seconds = Math.floor(milliseconds / 1000);
  const ms = milliseconds % 1000;

  return (
    hours.toString().padStart(2, "0") +
    ":" +
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0")
  );
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
  const [time, milliseconds] = timeString.split(",");
  const [hours, minutes, seconds] = time.split(":");

  return (
    parseInt(hours, 10) * 3600000 +
    parseInt(minutes, 10) * 60000 +
    parseInt(seconds, 10) * 1000 +
    parseInt(milliseconds, 10)
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
