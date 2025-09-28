import esbuild from "esbuild";
import { readFileSync } from "fs";

const banner = {
  js: readFileSync("./banner.js", "utf8"),
};

const isWatch = process.argv.includes("--watch");
const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  sourcemap: isWatch,
  format: "cjs",
  platform: "node",
  external: ["obsidian"],
  banner,
  loader: {
    ".css": "text",
    ".json": "json",
  },
  supported: {
    "top-level-await": false,
  },
});

if (isWatch) {
  await context.watch();
  await context.serve({ servedir: "." });
} else {
  await context.rebuild();
  await context.dispose();
}
