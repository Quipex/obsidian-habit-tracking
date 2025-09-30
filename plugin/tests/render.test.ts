import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";

describe("Habit button rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts a card with default configuration", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({ title: "Test Habit" });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const card = container.querySelector(".dv-habit-card");
    expect(card).not.toBeNull();

    const title = card?.querySelector(".dv-habit-title");
    expect(title?.textContent).toContain("Test Habit");

    const meta = card?.querySelector(".dv-habit-meta");
    expect(meta).not.toBeNull();
  });

  it("applies custom icon and css variables", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({
      title: "Stretch",
      extraLines: [
        'icon: "🧘"',
        "cellSize: 12",
        "cellGap: 5",
        "dotSize: 7",
        "dotGap: 2",
      ],
    });

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const card = container.querySelector<HTMLDivElement>(".dv-habit-card");
    expect(card).not.toBeNull();
    expect(card?.style.getPropertyValue("--habit-cell-size")).toBe("12px");
    expect(card?.style.getPropertyValue("--habit-cell-gap")).toBe("5px");
    expect(card?.style.getPropertyValue("--habit-dot-size")).toBe("7px");
    expect(card?.style.getPropertyValue("--habit-dot-gap")).toBe("2px");

    const iconBtn = card?.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(iconBtn?.textContent).toBe("🧘");
  });
});
