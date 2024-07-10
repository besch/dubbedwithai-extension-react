// build-extension.mjs

import dotenv from "dotenv";
import { replaceInFile } from "replace-in-file";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

dotenv.config();
dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.join(__dirname, "build");

const filesToProcess = ["background.js", "content.js"];
const filesPaths = filesToProcess.map((file) => path.join(buildDir, file));

// Filter out non-existent files
const existingFiles = filesPaths.filter((file) => fs.existsSync(file));

const options = {
  files: existingFiles,
  from: /\$\{process\.env\.REACT_APP_BASE_API_URL\}/g,
  to: (match) => {
    // Remove any surrounding quotes and backticks
    const url = process.env.REACT_APP_BASE_API_URL.replace(
      /^["'`]|["'`]$/g,
      ""
    );
    console.log("url", url);
    return url;
  },
};

async function processFiles() {
  try {
    if (existingFiles.length === 0) {
      console.warn(
        "No files found to process. Make sure the build step completed successfully."
      );
      return;
    }
    const results = await replaceInFile(options);
    console.log("Replacement results:", results);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

processFiles();
