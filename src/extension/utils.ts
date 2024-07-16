import { Subtitle } from "./content/types";
import { timeStringToMilliseconds } from "./content/utils";

export interface SrtObject {
  index?: string;
  timestamp?: string;
  start?: string;
  end?: string;
  text: string;
}

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

  console.log(`Parsed ${subtitles.length} subtitles`);
  if (subtitles.length > 0) {
    console.log("First subtitle:", subtitles[0]);
    console.log("Last subtitle:", subtitles[subtitles.length - 1]);
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
