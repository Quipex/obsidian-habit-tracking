import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, flushPromises, getTodayPath } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";

const NOW = new Date("2024-06-15T06:30:00Z");

describe("template handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates note from template with trailing newline", async () => {
    // given
    const plugin = await bootstrapPlugin({ templatePath: " templates/daily.md " });
    plugin.vault.files.set("templates/daily.md", "Template body\n");

    const habitDefinition = buildHabitDefinition({ title: "Template Habit" });
    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");

    // when
    button!.click();
    await flushPromises();

    // then
    const path = getTodayPath(plugin.settings.dailyFolder);
    const content = plugin.vault.files.get(path);
    expect(content).toMatch(/Template body\n\n- #habit_template_habit \d{2}:\d{2}\n/);
  });

  it("warns when template missing but still logs entry", async () => {
    // given
    const warnSpy = vi.spyOn(console, "warn");
    const plugin = await bootstrapPlugin({ templatePath: "templates/missing.md" });
    const habitDefinition = buildHabitDefinition({ title: "Missing Template" });
    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");

    // when
    button!.click();
    await flushPromises();

    // then
    const path = getTodayPath(plugin.settings.dailyFolder);
    const content = plugin.vault.files.get(path);
    expect(content).toMatch(/- #habit_missing_template \d{2}:\d{2}\n/);
    expect(warnSpy).toHaveBeenCalledWith(
      "Habit Button: unable to read template",
      "templates/missing.md",
    );
    warnSpy.mockRestore();
  });

  it("appends to existing note preserving newline", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const path = getTodayPath(plugin.settings.dailyFolder);
    plugin.vault.files.set(path, "Existing content\n");
    const habitDefinition = buildHabitDefinition({ title: "Append Habit" });
    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");

    // when
    button!.click();
    await flushPromises();

    // then
    const content = plugin.vault.files.get(path);
    expect(content).toMatch(/Existing content\n\n- #habit_append_habit \d{2}:\d{2}\n/);
  });
});
