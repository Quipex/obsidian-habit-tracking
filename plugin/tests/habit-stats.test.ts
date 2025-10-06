import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, getTodayPath } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";
import { seedHabitEntries, formatHabitEntryLine } from "./utils/habit-fixtures";
import { daysAgo } from "./utils/time";

const NOW = new Date("2024-06-15T09:00:00Z");

describe("habit stats computations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("filters markdown files by configured daily folder", async () => {
    // given
    const plugin = await bootstrapPlugin({ dailyFolder: " rituals/logs " });
    const otherDate = daysAgo(NOW, 1);
    seedHabitEntries(
      plugin,
      "stretch",
      [
        { isoDate: "2024-06-14", rawLine: "- #habit_stretch 07:30" },
        { isoDate: "2024-06-14", rawLine: "- #habit_stretch 20:15" },
      ],
      otherDate,
    );
    plugin.vault.files.set(
      `misc/${getTodayPath("")}`,
      `${formatHabitEntryLine(plugin, "stretch", "08:00")}\n`,
    );

    const habitDefinition = buildHabitDefinition({ title: "Stretch" });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button?.classList.contains("is-done")).toBe(false);
  });

  it("counts multiple marks per day and computes streak", async () => {
    // given
    const plugin = await bootstrapPlugin({ dailyFolder: "daily" });
    seedHabitEntries(plugin, "walk", [{ hoursAgo: 2 }, { hoursAgo: 1 }], NOW);
    const yesterday = daysAgo(NOW, 1);
    seedHabitEntries(plugin, "walk", [{ isoDate: "2024-06-14", rawLine: "- #habit_walk 18:00" }], yesterday);

    const habitDefinition = buildHabitDefinition({ title: "Walk" });

    // when
    const container = await renderHabit(plugin, habitDefinition);
    const { card, streak } = (await import("./utils/meta-elements")).getHabitMetaElements(container);

    // then
    expect(card.classList.contains("is-done")).toBe(true);
    expect(streak.textContent).toBe("Streak: 2 days");
  });

  it("ignores files that do not match YYYY-MM-DD format", async () => {
    // given
    const plugin = await bootstrapPlugin();
    plugin.vault.files.set("daily/June.md", "- #habit_focus 09:00\n");
    const habitDefinition = buildHabitDefinition({ title: "Focus" });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button?.classList.contains("is-done")).toBe(false);
  });

  it("parses nested daily notes using custom format", async () => {
    // given
    const plugin = await bootstrapPlugin({
      dailyFolder: "daily",
      dailyNoteFormat: "YYYY/MMMM/DD",
    });
    plugin.vault.files.set("daily/2024/June/15.md", "- #habit_focus 09:00\n");
    const habitDefinition = buildHabitDefinition({ title: "Focus" });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button?.classList.contains("is-done")).toBe(true);
  });

  it("combines grace period and warning window from settings when block omits override", async () => {
    // given
    const plugin = await bootstrapPlugin({
      defaultGracePeriodHours: 30,
      defaultWarningWindowHours: 6,
    });
    seedHabitEntries(plugin, "drink", [{ hoursAgo: 31 }], NOW);

    const habitDefinition = buildHabitDefinition({ title: "Drink" });

    // when
    const container = await renderHabit(plugin, habitDefinition);
    const { streak } = (await import("./utils/meta-elements")).getHabitMetaElements(container);

    // then
    const hint = streak.querySelector<HTMLSpanElement>(".time-left");
    expect(hint?.textContent).toBe(" <5h 🔥");
  });

  it("prioritises block warning window over settings and handles zero", async () => {
    // given
    const plugin = await bootstrapPlugin({
      defaultGracePeriodHours: 24,
      defaultWarningWindowHours: 12,
    });
    seedHabitEntries(plugin, "journal", [{ hoursAgo: 30 }], NOW);

    const habitDefinition = buildHabitDefinition({
      title: "Journal",
      warningWindowHours: 0,
    });

    // when
    const container = await renderHabit(plugin, habitDefinition);
    const { streak, card } = (await import("./utils/meta-elements")).getHabitMetaElements(container);

    // then
    expect(streak.querySelector(".time-left")).toBeNull();
    expect(card.classList.contains("is-done")).toBe(false);
  });
});
