import { Subtitle } from "@/types";

export function parseSrt(srtContent: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const lines = srtContent.split(/\r?\n/);
  let index = 0;

  const timecodePattern =
    /^\d{2}:\d{2}:\d{2},\d{3}\s*-->?\s*\d{2}:\d{2}:\d{2},\d{3}/;

  while (index < lines.length) {
    let line = lines[index].trim();

    // Skip index numbers or irrelevant lines
    while (index < lines.length && !timecodePattern.test(line)) {
      index++;
      line = lines[index] ? lines[index].trim() : "";
    }

    if (index >= lines.length) {
      break;
    }

    // Parse timecode line
    const timecodeLine = lines[index++].trim();
    const timecodeMatch = timecodeLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );

    if (!timecodeMatch) {
      continue;
    }

    const startTime = timeStringToMilliseconds(timecodeMatch[1]);
    const endTime = timeStringToMilliseconds(timecodeMatch[2]);

    // Read subtitle text lines
    const textLines = [];
    while (index < lines.length) {
      line = lines[index].trim();

      // If the line is empty or is a timecode, break
      if (line === "" || timecodePattern.test(line)) {
        break;
      }

      textLines.push(line);
      index++;
    }

    // Join text lines with spaces
    const subtitleText = cleanSubtitleText(textLines.join(" "));

    subtitles.push({
      start: startTime,
      end: endTime,
      text: subtitleText,
    });
  }

  return subtitles;
}

export const cleanSubtitleText = (text: string): string => {
  // Remove unwanted characters and strings
  return text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/\n/g, "") // Remove newlines
    .replace(/\[.*?\]/g, "") // Remove text in square brackets
    .replace(/```/g, "") // Remove triple backticks
    .trim(); // Trim whitespace
};

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
