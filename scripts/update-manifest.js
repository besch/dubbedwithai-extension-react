const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "../build/manifest.json");
const manifest = require(manifestPath);

// Update paths in the manifest
// manifest.content_scripts[0].js = ["content.js"];
manifest.background.service_worker = "background.js";

// Write the updated manifest back to the build directory
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log("Manifest file updated successfully.");
