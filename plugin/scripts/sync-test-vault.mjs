import { copyFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginRoot = path.resolve(__dirname, "..");
const vaultPluginDir = path.resolve(pluginRoot, "../test_vault/.obsidian/plugins/habit-button");

const filesToCopy = ["manifest.json", "main.js", "styles.css"];

mkdirSync(vaultPluginDir, { recursive: true });

for (const file of filesToCopy) {
  const source = path.join(pluginRoot, file);
  const target = path.join(vaultPluginDir, file);
  copyFileSync(source, target);
  console.log(`Copied ${file} -> ${path.relative(pluginRoot, target)}`);
}

console.log("Sync complete.");
