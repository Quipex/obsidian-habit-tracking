import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginRoot = path.resolve(__dirname, "..");
const manifestPath = path.resolve(pluginRoot, "../manifest.json");

const version = process.env.npm_package_version;

if (!version) {
  console.error("npm_package_version is not set. Run via npm version.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.version === version) {
  console.log(`manifest.json already at ${version}`);
  process.exit(0);
}

manifest.version = version;

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Updated manifest.json -> ${version}`);
