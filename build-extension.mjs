import dotenv from "dotenv";
import { replaceInFile } from "replace-in-file";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.join(__dirname, "build");

const filesToProcess = ["background.js", "content.js", "utils.js"];
const filesPaths = filesToProcess.map((file) => path.join(buildDir, file));

const options = {
  files: filesPaths,
  from: /\$\{process\.env\.REACT_APP_BASE_API_URL\}/g,
  to: (match) => {
    // Remove any surrounding quotes and backticks
    const url = process.env.REACT_APP_BASE_API_URL.replace(
      /^["'`]|["'`]$/g,
      ""
    );
    return url;
  },
};

async function processFiles() {
  try {
    const results = await replaceInFile(options);
    console.log("Replacement results:", results);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

processFiles();
