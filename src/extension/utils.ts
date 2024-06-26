export interface SrtObject {
  index?: string;
  timestamp?: string;
  start?: string;
  end?: string;
  text: string;
}

export function srtToObject(srtData: string): SrtObject[] {
  const a: SrtObject[] = [];
  const normalizedSrtData = srtData.replace(/\r\n/g, "\n");
  const lines = normalizedSrtData.split("\n");
  const len = lines.length;

  let o: SrtObject = {
    text: "",
  };

  for (let i = 0; i < len; i++) {
    const line = lines[i].trim();
    let times: string[];
    let lineBreak = "\n";

    if (!isNaN(parseInt(line, 10)) && (i === 0 || lines[i - 1] === "")) {
      // we found an index
      o.index = line;
    } else if (line.indexOf(" --> ") > -1) {
      // we found a timestamp
      o.timestamp = line;
      times = line.split(" --> ");
      o.start = times[0];
      o.end = times[1];
    } else if (line === "") {
      // we found an empty string, so push o and reset everything
      a.push(o);
      o = { text: "" };
    } else {
      // we must have text to enter since it's not an index, timestamp or empty string.
      // don't add `\n` to the end of the last line of text
      if (lines[i + 1] === "") {
        lineBreak = "";
      }
      o.text += line + lineBreak;
    }
  }
  return a;
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
