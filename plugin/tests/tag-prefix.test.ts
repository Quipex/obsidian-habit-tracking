import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, flushPromises, getTodayPath } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";
import { seedHabitEntries, formatHabitEntryLine } from "./utils/habit-fixtures";

const NOW = new Date("2024-06-15T09:00:00Z");

describe("tag prefix handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recognises entries written with custom prefix", async () => {
    // given
    const plugin = await bootstrapPlugin({ tagPrefix: "ritual" });
    seedHabitEntries(plugin, "breathwork", [{ hoursAgo: 2 }], NOW);
    const habitDefinition = buildHabitDefinition({ title: "Breathwork" });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button?.classList.contains("is-done")).toBe(true);
  });

  it("sanitises prefix before logging", async () => {
    // given
    const plugin = await bootstrapPlugin({ tagPrefix: "  R!it-Ual  " });
    const habitDefinition = buildHabitDefinition({ title: "Focus" });
    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button).not.toBeNull();

    // when
    button!.click();
    await flushPromises();

    // then
    const path = getTodayPath(plugin.settings.dailyFolder);
    const content = plugin.vault.files.get(path) ?? "";
    expect(content).toContain("#r_it_ual_focus");
    expect(content).not.toContain("R!it-Ual");
  });

  it("does not mix records between habits", async () => {
    // given
    const plugin = await bootstrapPlugin({ tagPrefix: "ritual" });
    seedHabitEntries(plugin, "movement", [{ hoursAgo: 3 }], NOW);
    const otherLine = formatHabitEntryLine(plugin, "journaling", "06:30");
    const otherPath = getTodayPath(plugin.settings.dailyFolder);
    const existing = plugin.vault.files.get(otherPath) ?? "";
    plugin.vault.files.set(otherPath, `${existing}${otherLine}\n`);

    const movementDef = buildHabitDefinition({ title: "Movement" });
    const journalDef = buildHabitDefinition({ title: "Journaling" });

    // when
    const moveContainer = await renderHabit(plugin, movementDef);
    const journalContainer = await renderHabit(plugin, journalDef);

    // then
    const moveButton = moveContainer.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    const journalButton = journalContainer.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(moveButton?.classList.contains("is-done")).toBe(true);
    expect(journalButton?.classList.contains("is-done")).toBe(true);

    const separateDef = buildHabitDefinition({ title: "Breathwork" });
    const separateContainer = await renderHabit(plugin, separateDef);
    const separateButton = separateContainer.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(separateButton?.classList.contains("is-done")).toBe(false);
  });
});
