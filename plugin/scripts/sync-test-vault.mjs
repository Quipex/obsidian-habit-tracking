import { copyFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginRoot = path.resolve(__dirname, "..");
const vaultPluginDir = path.resolve(pluginRoot, "../test_vault/.obsidian/plugins/habit-button");

const filesToCopy = [
  { source: path.resolve(pluginRoot, "../manifest.json"), name: "manifest.json" },
  { source: path.join(pluginRoot, "main.js"), name: "main.js" },
  { source: path.join(pluginRoot, "styles.css"), name: "styles.css" },
];

mkdirSync(vaultPluginDir, { recursive: true });

for (const { source, name } of filesToCopy) {
  const target = path.join(vaultPluginDir, name);
  copyFileSync(source, target);
  console.log(`Copied ${name} -> ${path.relative(pluginRoot, target)}`);
}

console.log("Sync complete.");
