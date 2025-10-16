import { describe, it, expect } from "vitest";
import HabitRegistry from "../src/habit-registry";
import type { ResolvedHabitOptions, HabitStats } from "../src/habit-core";

const baseOptions: ResolvedHabitOptions = {
  title: "Test",
  normalizedTitle: "Test",
  group: "focus",
  gracePeriodHours: 24,
  warningWindowHours: 24,
  icon: undefined,
  dailyFolder: "daily",
  dailyNoteFormat: "YYYY-MM-DD",
  heatLayout: "grid",
  weeks: 4,
  days: 30,
  cellSize: 9,
  cellGap: 3,
  dotSize: 8,
  dotGap: 4,
  templatePath: undefined,
  habitKey: "test",
  habitTag: "#habit_test",
  tagPrefix: "habit",
  border: true,
};

function makeStats(overrides: Partial<HabitStats> = {}): HabitStats {
  const baseTimestamp = new Date("2024-06-15T08:00:00Z");
  const countsByISO = new Map<string, number>([["2024-06-15", 1]]);
  const hasByISO = new Set<string>(["2024-06-15"]);
  const lastTsByISO = new Map<string, Date>([["2024-06-15", new Date(baseTimestamp)]]);
  return {
    countsByISO,
    hasByISO,
    lastTsByISO,
    lastTs: new Date(baseTimestamp),
    streak: 1,
    allowedGapH: 24,
    allowedGapMs: 24 * 3600000,
    warningWindowHours: 24,
    ...overrides,
  };
}

describe("HabitRegistry", () => {
  it("returns change flag based on fingerprint", () => {
    const registry = new HabitRegistry();
    const first = registry.upsert({
      habitKey: "test",
      group: "focus",
      sourcePath: "daily/2024-06-15.md",
      options: baseOptions,
      stats: makeStats(),
    });
    expect(first.changed).toBe(true);

    const second = registry.upsert({
      habitKey: "test",
      group: "focus",
      sourcePath: "daily/2024-06-15.md",
      options: baseOptions,
      stats: makeStats(),
    });
    expect(second.changed).toBe(false);
  });

  it("removes records and exposes duplicates", () => {
    const registry = new HabitRegistry();
    registry.upsert({
      habitKey: "test",
      group: "focus",
      sourcePath: "daily/2024-06-15.md",
      options: baseOptions,
      stats: makeStats(),
    });
    registry.upsert({
      habitKey: "test",
      group: "focus",
      sourcePath: "daily/2024-06-16.md",
      options: baseOptions,
      stats: makeStats(),
    });

    const duplicates = registry.getDuplicates();
    expect(duplicates.get("test")?.length).toBe(2);

    const removed = registry.remove("test", "daily/2024-06-15.md");
    expect(removed?.sourcePath).toBe("daily/2024-06-15.md");
    expect(registry.getDuplicates().size).toBe(0);
  });

  it("prunes stale entries for the same group and path", () => {
    const registry = new HabitRegistry();
    registry.upsert({
      habitKey: "alpha",
      group: "focus",
      sourcePath: "habits/focus.md",
      options: baseOptions,
      stats: makeStats(),
    });
    registry.upsert({
      habitKey: "beta",
      group: "focus",
      sourcePath: "habits/focus.md",
      options: { ...baseOptions, habitKey: "beta", habitTag: "#habit_beta" },
      stats: makeStats(),
    });

    const removed = registry.pruneSourceRecords("habits/focus.md", "focus", new Set(["beta"]));
    expect(removed.map((entry) => entry.habitKey)).toContain("alpha");
    const remaining = registry.getByGroup("focus").map((entry) => entry.habitKey);
    expect(remaining).toEqual(["beta"]);
  });
});
