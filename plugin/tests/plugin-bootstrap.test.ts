import { describe, expect, it } from "vitest";
import { bootstrapPlugin } from "./harness";

describe("HabitButtonPlugin bootstrap", () => {
  it("registers command and code block on load", async () => {
    const plugin = await bootstrapPlugin();

    const command = plugin.commands.find((cmd) => cmd.id === "habit-button-insert-block");
    expect(command).toBeTruthy();

    const processor = plugin.processors.find((entry) => entry.language === "habit-button");
    expect(processor).toBeTruthy();

    expect(plugin.settingTabs.length).toBeGreaterThan(0);
  });
});
