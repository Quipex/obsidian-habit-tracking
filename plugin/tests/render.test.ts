import { describe, expect, it } from "vitest";
import { bootstrapPlugin, renderHabitBlock } from "./harness";

describe("Habit button rendering", () => {
  it("mounts a card with default configuration", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = `title: Test Habit`;

    // when
    const container = await renderHabitBlock(plugin, habitDefinition);

    // then
    const card = container.querySelector(".dv-habit-card");
    expect(card).not.toBeNull();

    const title = card?.querySelector(".dv-habit-title");
    expect(title?.textContent).toContain("Test Habit");

    const meta = card?.querySelector(".dv-habit-meta");
    expect(meta).not.toBeNull();
  });
});
