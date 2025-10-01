import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "tests/stubs/obsidian.ts"),
    },
  },
  plugins: [
    {
      name: "stub-css",
      enforce: "pre",
      transform(_, id) {
        if (id.endsWith(".css")) {
          return { code: "export default \"\";", map: null };
        }
        return null;
      },
    },
  ],
});
