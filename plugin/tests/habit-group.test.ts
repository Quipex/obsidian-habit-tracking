import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, renderHabitBlock, renderBlock, flushPromises } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";

const NOW = new Date("2024-06-15T10:00:00Z");

describe("habit-group block", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregates habits from registry without scanning", async () => {
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({
      title: "Focus",
      extraLines: ["group: squads"],
    });

    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button).not.toBeNull();

    const groupBlock = ["title: Squad Overview", "group: squads"].join("\n");
    const groupContainer = await renderBlock(plugin, "habit-group", groupBlock);
    const getSummary = () =>
      groupContainer.querySelector<HTMLDivElement>(".dv-habit-group-summary");
    expect(getSummary()?.textContent).toBe("0/1");

    button!.click();
    await flushPromises();

    // allow group to rerender
    await flushPromises();
    expect(getSummary()?.textContent).toBe("1/1");
  });

  it("scans configured locations when registry is empty", async () => {
    const plugin = await bootstrapPlugin();
    plugin.vault.files.set(
      "habits/focus.md",
      [
        "```habit-button",
        "title: Focus",
        "group: squads",
        "```",
        "",
      ].join("\n"),
    );
    plugin.vault.files.set("daily/2024-06-15.md", "- #habit_focus 08:00\n");

    const groupBlock = [
      "title: Squad Overview",
      "group: squads",
      "habitsLocations: habits",
      "eagerScan: true",
    ].join("\n");

    const groupContainer = await renderBlock(plugin, "habit-group", groupBlock);
    await flushPromises();
    const records = plugin.getHabitRegistry().getByGroup("squads");
    expect(records.length).toBe(1);
    const summary = groupContainer.querySelector<HTMLDivElement>(".dv-habit-group-summary");
    expect(summary?.textContent).toBe("1/1");
  });

  it("shows duplicates warning when multiple declarations found", async () => {
    const plugin = await bootstrapPlugin();
    const habitBlock = [
      "```habit-button",
      "title: Focus",
      "group: squads",
      "```",
      "",
    ].join("\n");
    plugin.vault.files.set("habits/focus.md", habitBlock);
    plugin.vault.files.set("habits/focus-copy.md", habitBlock);

    const groupBlock = [
      "group: squads",
      "habitsLocations:",
      "  - habits/focus.md",
      "  - habits/focus-copy.md",
    ].join("\n");

    const groupContainer = await renderBlock(plugin, "habit-group", groupBlock);
    await flushPromises();
    const warning = groupContainer.querySelector<HTMLDivElement>(".dv-habit-group-duplicates");
    expect(warning?.textContent).toContain("Найдены дублирующиеся привычки");
  });
});
