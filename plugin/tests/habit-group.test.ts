import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, renderHabitBlock, renderBlock, flushPromises } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";
import { seedHabitEntries } from "./utils/habit-fixtures";

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
    expect(warning?.textContent).toContain("Duplicate habits found:");
  });

  it("supports borderless group layout", async () => {
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({
      title: "Focus",
      extraLines: ["group: squads"],
    });
    await renderHabit(plugin, habitDefinition);

    const groupBlock = [
      "group: squads",
      "border: false",
    ].join("\n");

    const groupContainer = await renderBlock(plugin, "habit-group", groupBlock);
    const panel = groupContainer.querySelector<HTMLDivElement>(".dv-habit-group");
    expect(panel?.classList.contains("is-borderless")).toBe(true);
    expect(panel?.classList.contains("has-border")).toBe(false);
    const title = panel?.querySelector<HTMLDivElement>(".dv-habit-group-title");
    expect(title?.textContent).toBe("Squads");
  });

  it("uses global border preference when block omits override", async () => {
    const plugin = await bootstrapPlugin({ defaultBorder: false });
    const habitDefinition = buildHabitDefinition({
      title: "Focus",
      extraLines: ["group: squads"],
    });
    await renderHabit(plugin, habitDefinition);

    const groupBlock = ["group: squads"].join("\n");
    const groupContainer = await renderBlock(plugin, "habit-group", groupBlock);
    const panel = groupContainer.querySelector<HTMLDivElement>(".dv-habit-group");
    expect(panel?.classList.contains("is-borderless")).toBe(true);
  });

  it("updates progress bar according to aggregate", async () => {
    const plugin = await bootstrapPlugin();
    const habitDefinitionA = buildHabitDefinition({
      title: "Progress A",
      extraLines: ["group: squads"],
    });
    const habitDefinitionB = buildHabitDefinition({
      title: "Progress B",
      extraLines: ["group: squads"],
    });

    await renderHabit(plugin, habitDefinitionA);
    await renderHabit(plugin, habitDefinitionB);

    const groupBlock = ["group: squads"].join("\n");

    const initial = await renderBlock(plugin, "habit-group", groupBlock);
    await flushPromises();
    const barInitial = initial.querySelector<HTMLDivElement>(".dv-habit-group-progress-bar");
    expect(barInitial?.style.width).toBe("0%");

    seedHabitEntries(plugin, "progress_a", [{ hoursAgo: 1 }], NOW);
    await renderHabit(plugin, habitDefinitionA);
    const half = await renderBlock(plugin, "habit-group", groupBlock);
    await flushPromises();
    const barHalf = half.querySelector<HTMLDivElement>(".dv-habit-group-progress-bar");
    expect(barHalf?.style.width).toBe("50%");

    seedHabitEntries(plugin, "progress_b", [{ hoursAgo: 1 }], NOW);
    await renderHabit(plugin, habitDefinitionB);
    const full = await renderBlock(plugin, "habit-group", groupBlock);
    await flushPromises();
    const barFull = full.querySelector<HTMLDivElement>(".dv-habit-group-progress-bar");
    expect(barFull?.style.width).toBe("100%");
  });
});
