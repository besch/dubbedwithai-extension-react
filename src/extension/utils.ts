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
  const srtObjects: Subtitle[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const [, timestamp, ...textLines] = lines;
    const [start, end] = timestamp.split(" --> ").map(timeStringToMilliseconds);

    const text = textLines
      .join(" ")
      .replace(/\s+/g, " ")
      .replace(/(<[^>]+>) /g, "$1")
      .replace(/\s*(\{\\[^}]+\})\s*/g, "$1")
      .trim();

    srtObjects.push({
      start,
      end,
      text,
    });
  }

  return srtObjects;
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
