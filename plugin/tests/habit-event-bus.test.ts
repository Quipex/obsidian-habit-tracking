import { describe, it, expect, vi } from "vitest";
import HabitEventBus from "../src/habit-event-bus";

describe("HabitEventBus", () => {
  it("normalizes group names and notifies listeners", () => {
    const bus = new HabitEventBus();
    const listener = vi.fn();

    bus.onGroup("Focus", listener);
    bus.emitGroup("focus");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns disposer that removes listener", () => {
    const bus = new HabitEventBus();
    const listener = vi.fn();
    const dispose = bus.onGroup("focus", listener);

    dispose();
    bus.emitGroup("focus");

    expect(listener).not.toHaveBeenCalled();
  });

  it("clears all listeners", () => {
    const bus = new HabitEventBus();
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    bus.onGroup("focus", listenerA);
    bus.onGroup("health", listenerB);

    bus.clear();
    bus.emitGroup("focus");
    bus.emitGroup("health");

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).not.toHaveBeenCalled();
  });
});
