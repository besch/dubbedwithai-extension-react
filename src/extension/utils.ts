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

export function extractMovieTitle(html: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Array of possible selectors and properties to check
  const titleSelectors: { selector: string; attribute: string }[] = [
    { selector: 'meta[property="og:title"]', attribute: "content" },
    { selector: 'meta[name="og:title"]', attribute: "content" },
    { selector: "title", attribute: "textContent" },
    { selector: 'meta[name="title"]', attribute: "content" },
    { selector: "h1", attribute: "textContent" },
  ];

  for (const { selector, attribute } of titleSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      let title: string | null = null;

      if (attribute === "textContent") {
        title = element.textContent;
      } else {
        title = element.getAttribute(attribute);
      }

      if (title) {
        // Clean up the title
        title = title
          .replace(/\s*\|\s*.*$/, "") // Remove site name after '|'
          .replace(/^Watch\s+/, "") // Remove 'Watch' from the beginning
          .replace(/\s+(?:Full Movie|Online|Free|TV|in HD).*$/i, "") // Remove common suffixes
          .replace(/\s*-\s*.*$/, "") // Remove everything after '-'
          .trim();

        return title;
      }
    }
  }

  return null;
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
