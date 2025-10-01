import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, flushPromises } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";

const NOW = new Date("2024-06-15T07:45:00Z");

describe("icon behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows custom icon before marking and swaps to checkmark after", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({
      title: "Tea",
      extraLines: ['icon: "🍵"'],
    });

    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button?.textContent).toBe("🍵");

    // when
    button!.click();
    await flushPromises();

    // then
    expect(button?.textContent).toBe("✓");
  });

  it("restores custom icon after logging when a different day is rendered", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({
      title: "Tea",
      extraLines: ['icon: "🍵"'],
    });

    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    button!.click();
    await flushPromises();
    expect(button?.textContent).toBe("✓");

    // when: simulate next day and re-render
    const tomorrow = new Date(NOW.getTime());
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.setSystemTime(tomorrow);
    const nextContainer = await renderHabit(plugin, habitDefinition);
    const nextButton = nextContainer.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");

    // then
    expect(nextButton?.textContent).toBe("🍵");
  });
});
