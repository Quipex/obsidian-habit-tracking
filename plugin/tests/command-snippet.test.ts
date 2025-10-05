import { describe, expect, it } from "vitest";
import { bootstrapPlugin } from "./harness";
import { HABIT_BLOCK_OPTION_KEYS } from "../src/habit-core";

class FakeEditor {
  public buffer = "";
  getCursor() {
    return { line: 0, ch: 0 };
  }
  replaceRange(text: string) {
    this.buffer = text;
  }
}

describe("command snippet", () => {
  it("inserts snippet respecting current settings", async () => {
    // given
    const plugin = await bootstrapPlugin({ defaultLayout: "row" });
    const command = plugin.commands.find((cmd) => cmd.id === "habit-button-insert-block");
    expect(command).toBeDefined();
    const editor = new FakeEditor();

    // when
    command!.editorCallback?.(editor as any);

    // then
    const expectedSnippet = [
      "```habit-button",
      "title: My habit",
      "",
      "# Optional overrides (remove '#' before the property name to apply it):",
      "# heatLayout: row # \"grid\" or \"row\"",
      "# group: morning # the name of the habit-group. should match the 'group' property in the habit-group block",
      "# icon: ☀️",
      "# weeks: 26 # applies for 'heatLayout: grid' only",
      "# days: 30 # applies for 'heatLayout: row' only",
      "# gracePeriodHours: 24 # How many hours can pass before the streak breaks (warning window is added on top)",
      "# warningWindowHours: 6 # Hours before the break when the flame indicator appears",
      "# cellSize: 9 # Pixel size of heatmap cells",
      "# cellGap: 3 # Space between heatmap cells",
      "# dotSize: 8 # Pixel size of heatmap dots",
      "# dotGap: 4 # Space between heatmap dots",
      "# border: true # Show card borders",
      "```",
      "",
    ].join("\n");

    expect(editor.buffer).toBe(expectedSnippet);

    for (const key of HABIT_BLOCK_OPTION_KEYS) {
      const token = key === "title" ? "title:" : `# ${key}:`;
      expect(editor.buffer.includes(token)).toBe(true);
    }
  });
});
