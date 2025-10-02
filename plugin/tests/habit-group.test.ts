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
    const getSummaryLabel = () =>
      groupContainer.querySelector<HTMLDivElement>(".dv-habit-group-summary-label");
    expect(getSummaryLabel()?.textContent).toBe("0/1");

    button!.click();
    await flushPromises();

    // allow group to rerender
    await flushPromises();
    expect(getSummaryLabel()?.textContent).toBe("1/1");
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
    const summaryLabel = groupContainer.querySelector<HTMLDivElement>(".dv-habit-group-summary-label");
    expect(summaryLabel?.textContent).toBe("1/1");
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

  it("renders icon when provided", async () => {
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({
      title: "Focus",
      extraLines: ["group: squads"],
    });
    await renderHabit(plugin, habitDefinition);

    const groupBlock = ["group: squads", "icon: ⚡"].join("\n");
    const groupContainer = await renderBlock(plugin, "habit-group", groupBlock);
    const layout = groupContainer.querySelector<HTMLDivElement>(".dv-habit-group-layout.has-icon");
    const icon = layout?.querySelector<HTMLDivElement>(".dv-habit-group-icon");
    const title = layout?.querySelector<HTMLDivElement>(".dv-habit-group-title");
    const status = layout?.querySelector<HTMLDivElement>(".dv-habit-group-status");
    expect(layout).not.toBeNull();
    expect(icon?.textContent).toBe("⚡");
    expect(title?.textContent).toBe("Squads");
    expect(status?.querySelector(".dv-habit-group-summary-label")).not.toBeNull();
  });

  it("renders colored progress segments and aggregate tint", async () => {
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

    const renderGroup = async () => {
      const container = await renderBlock(plugin, "habit-group", groupBlock);
      await flushPromises();
      return container;
    };

    const readSegmentStates = (container: HTMLElement): string[] => {
      const segments = Array.from(
        container.querySelectorAll<HTMLDivElement>(".dv-habit-group-segment"),
      );
      return segments.map((segment) => {
        if (segment.classList.contains("is-emerald")) return "emerald";
        if (segment.classList.contains("is-amber")) return "amber";
        return "gray";
      });
    };

    const readLabel = (container: HTMLElement) =>
      container.querySelector<HTMLDivElement>(".dv-habit-group-summary-label");

    const initial = await renderGroup();
    expect(readSegmentStates(initial)).toEqual(["gray", "gray"]);
    const initialLabel = readLabel(initial);
    expect(initialLabel?.textContent).toBe("0/2");
    expect(initialLabel?.classList.contains("is-amber")).toBe(true);

    seedHabitEntries(plugin, "progress_a", [{ hoursAgo: 1 }], NOW);
    await renderHabit(plugin, habitDefinitionA);
    const mid = await renderGroup();
    expect(readSegmentStates(mid)).toEqual(["emerald", "gray"]);
    const midLabel = readLabel(mid);
    expect(midLabel?.textContent).toBe("1/2");
    expect(midLabel?.classList.contains("is-amber")).toBe(true);

    seedHabitEntries(plugin, "progress_b", [{ hoursAgo: 1 }], NOW);
    await renderHabit(plugin, habitDefinitionB);
    const full = await renderGroup();
    expect(readSegmentStates(full)).toEqual(["emerald", "emerald"]);
    const fullLabel = readLabel(full);
    expect(fullLabel?.textContent).toBe("2/2");
    expect(fullLabel?.classList.contains("is-emerald")).toBe(true);
  });

  it("orders segments by state priority", async () => {
    const plugin = await bootstrapPlugin();
    const healthyHabit = buildHabitDefinition({
      title: "Healthy",
      extraLines: ["group: squads"],
    });
    const warningHabit = buildHabitDefinition({
      title: "Warning",
      extraLines: ["group: squads"],
    });
    const staleHabit = buildHabitDefinition({
      title: "Stale",
      extraLines: ["group: squads"],
    });

    await renderHabit(plugin, healthyHabit);
    await renderHabit(plugin, warningHabit);
    await renderHabit(plugin, staleHabit);

    seedHabitEntries(plugin, "healthy", [{ hoursAgo: 1 }], NOW);
    await renderHabit(plugin, healthyHabit);

    seedHabitEntries(plugin, "warning", [{ hoursAgo: 30 }], NOW);
    await renderHabit(plugin, warningHabit);

    const groupBlock = ["group: squads"].join("\n");
    const container = await renderBlock(plugin, "habit-group", groupBlock);
    await flushPromises();

    const segments = Array.from(
      container.querySelectorAll<HTMLDivElement>(".dv-habit-group-segment"),
    ).map((segment) => {
      if (segment.classList.contains("is-emerald")) return "emerald";
      if (segment.classList.contains("is-amber")) return "amber";
      return "gray";
    });

    expect(segments).toEqual(["emerald", "amber", "gray"]);
  });

  it("counts warning streaks towards aggregate", async () => {
    const plugin = await bootstrapPlugin();
    const graceHabit = buildHabitDefinition({
      title: "Graceful",
      extraLines: ["group: squads"],
    });
    const warningHabit = buildHabitDefinition({
      title: "Warning",
      extraLines: ["group: squads"],
    });
    const staleHabit = buildHabitDefinition({
      title: "Stale",
      extraLines: ["group: squads"],
    });

    await renderHabit(plugin, graceHabit);
    await renderHabit(plugin, warningHabit);
    await renderHabit(plugin, staleHabit);

    seedHabitEntries(plugin, "graceful", [{ hoursAgo: 10 }], NOW);
    await renderHabit(plugin, graceHabit);

    seedHabitEntries(plugin, "warning", [{ hoursAgo: 30 }], NOW);
    await renderHabit(plugin, warningHabit);

    seedHabitEntries(plugin, "stale", [{ hoursAgo: 60 }], NOW);
    await renderHabit(plugin, staleHabit);

    const groupBlock = ["group: squads"].join("\n");
    const container = await renderBlock(plugin, "habit-group", groupBlock);
    await flushPromises();

    const label = container.querySelector<HTMLDivElement>(".dv-habit-group-summary-label");
    expect(label?.textContent).toBe("2/3");
    expect(label?.classList.contains("is-amber")).toBe(true);

    const segments = Array.from(
      container.querySelectorAll<HTMLDivElement>(".dv-habit-group-segment"),
    ).map((segment) => {
      if (segment.classList.contains("is-emerald")) return "emerald";
      if (segment.classList.contains("is-amber")) return "amber";
      return "gray";
    });

    expect(segments).toEqual(["emerald", "amber", "gray"]);
  });
});
