import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, getTodayPath, renderHabitBlock, flushPromises } from "./harness";
import { formatTime } from "./utils/time";

const FIXED_DATE = new Date("2024-06-15T08:30:00Z");
const EXPECTED_TIME = formatTime(new Date(FIXED_DATE));

describe("Habit logging", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a daily note when none exists", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = `title: Morning Walk`;

    const container = await renderHabitBlock(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button).not.toBeNull();

    // when
    button!.click();
    await flushPromises();

    // then
    const dailyPath = getTodayPath(plugin.settings.dailyFolder);
    const fileContent = plugin.vault.files.get(dailyPath);
    expect(fileContent).toContain(`- #habit_morning_walk ${EXPECTED_TIME}`);
    expect(button?.classList.contains("is-done")).toBe(true);
  });

  it("appends to an existing daily note", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const dailyPath = getTodayPath(plugin.settings.dailyFolder);
    plugin.vault.files.set(dailyPath, "# Daily note\n");

    const habitDefinition = `title: Creatine`;
    const container = await renderHabitBlock(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button).not.toBeNull();

    // when
    button!.click();
    await flushPromises();

    // then
    const fileContent = plugin.vault.files.get(dailyPath);
    expect(fileContent).toContain(`# Daily note

- #habit_creatine ${EXPECTED_TIME}`);
    expect(button?.classList.contains("is-done")).toBe(true);
  });
});
