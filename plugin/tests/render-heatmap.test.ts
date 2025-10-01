import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";

const NOW = new Date("2024-06-15T12:00:00Z");

describe("habit heatmap rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders row layout with requested number of days ending today", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({
      title: "Row Test",
      extraLines: ["heatLayout: row", "days: 7"],
    });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const dots = container.querySelectorAll<HTMLDivElement>(".dv-habit-heat-row .dv-habit-dot");
    expect(dots.length).toBe(7);
    const lastDot = dots[dots.length - 1];
    expect(lastDot.title?.startsWith("2024-06-15")).toBe(true);
  });

  it("renders grid layout with weekStart override and labels domains", async () => {
    // given
    const plugin = await bootstrapPlugin({ weekStart: "sunday" });
    const habitDefinition = buildHabitDefinition({
      title: "Grid Test",
      extraLines: ["heatLayout: grid", "weeks: 3"],
    });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const columns = container.querySelectorAll<HTMLDivElement>(".dv-habit-heat-grid .dv-habit-col");
    expect(columns.length).toBe(3);
    for (const column of columns) {
      expect(column.children.length).toBe(7);
    }

    const firstColumn = columns[0];
    const firstCell = firstColumn.children[0] as HTMLDivElement;
    expect(firstCell.title).toMatch(/2024/);
  });

  it("applies CSS variables from settings to grid layout", async () => {
    // given
    const plugin = await bootstrapPlugin({
      defaultCellSize: 15,
      defaultCellGap: 2,
    });
    const habitDefinition = buildHabitDefinition({
      title: "Grid Styles",
      extraLines: ["heatLayout: grid"],
    });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const card = container.querySelector<HTMLDivElement>(".dv-habit-card");
    expect(card?.style.getPropertyValue("--habit-cell-size")).toBe("15px");
    expect(card?.style.getPropertyValue("--habit-cell-gap")).toBe("2px");
  });
});
