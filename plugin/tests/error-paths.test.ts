import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, renderHabitBlock, flushPromises, getTodayPath } from "./harness";
import { renderHabit } from "./utils/habit-block";
import { Notice } from "obsidian";

describe("error paths", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Notice.all = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    Notice.all = [];
  });

  it("renders error block for invalid yaml", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const invalidBlock = `title: [unclosed`;
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // when
    const container = await renderHabitBlock(plugin, invalidBlock);

    // then
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toBe("[habit-button] Title is required");
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("shows notice when logging fails", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = `title: Failure Habit`;
    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button).not.toBeNull();

    const path = getTodayPath(plugin.settings.dailyFolder);
    plugin.vault.files.set(path, "Existing\n");

    const appendSpy = vi.spyOn(plugin.vault, "append").mockRejectedValueOnce(new Error("boom"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // when
    button!.click();
    await flushPromises();

    // then
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(Notice.all.at(-1)?.message).toBe("Failed to record habit");
    expect(errorSpy).toHaveBeenCalledWith("[habit-button] append error", expect.any(Error));

    errorSpy.mockRestore();
    appendSpy.mockRestore();
  });
});
