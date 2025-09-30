import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin } from "./harness";
import { buildHabitDefinition, renderHabit } from "./utils/habit-block";
import { seedHabitEntries } from "./utils/habit-fixtures";
import { getHabitMetaElements } from "./utils/meta-elements";

const HABIT_TITLE = "Morning Stretch";
const HABIT_KEY = "morning_stretch";
const NOW = new Date(2024, 5, 15, 12, 0, 0);

function expectStreakText(streak: HTMLSpanElement, expected: string): void {
  expect(streak.textContent).toBe(expected);
}

describe("Habit meta warnings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows placeholders when no marks exist", async () => {
    // given
    const plugin = await bootstrapPlugin();
    const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE });

    // when
    const container = await renderHabit(plugin, habitDefinition);
    const { card, last, streak, button } = getHabitMetaElements(container);

    // then
    expect(last.textContent).toBe("—");
    expect(last.classList.contains("is-overdue")).toBe(false);
    expectStreakText(streak, "Streak: 0 days");
    expect(streak.classList.contains("is-zero")).toBe(true);
    expect(streak.querySelector(".time-left")).toBeNull();
    expect(card.classList.contains("is-done")).toBe(false);
    expect(button.classList.contains("is-done")).toBe(false);
  });

  describe("gracePeriodHours specified", () => {
    it("activates warning when less than a day remains", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 30 }], NOW);
      const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE, gracePeriodHours: 12 });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { card, last, streak, button } = getHabitMetaElements(container);

      // then
      expect(last.classList.contains("is-overdue")).toBe(true);
      expect(last.textContent).toBe("30h ago");
      expect(streak.textContent?.startsWith("Streak: 1 days")).toBe(true);
      expect(streak.classList.contains("is-zero")).toBe(false);
      const timeLeft = streak.querySelector<HTMLSpanElement>(".time-left");
      expect(timeLeft).not.toBeNull();
      expect(timeLeft?.textContent).toBe(" <6h 🔥");
      expect(card.classList.contains("is-done")).toBe(false);
      expect(button.classList.contains("is-done")).toBe(false);
    });

    it("keeps calm when buffer exceeds 24 hours", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 10 }], NOW);
      const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE, gracePeriodHours: 12 });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { last, streak } = getHabitMetaElements(container);

      // then
      expect(last.classList.contains("is-overdue")).toBe(false);
      expect(streak.classList.contains("is-zero")).toBe(false);
      expect(streak.querySelector(".time-left")).toBeNull();
    });

    it("keeps warning active when streak is broken", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 72 }], NOW);
      const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE, gracePeriodHours: 12 });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { last, streak } = getHabitMetaElements(container);

      // then
      expectStreakText(streak, "Streak: 0 days");
      expect(streak.classList.contains("is-zero")).toBe(true);
      expect(streak.querySelector(".time-left")).toBeNull();
      expect(last.classList.contains("is-overdue")).toBe(true);
    });

    it("marks today as done only when a mark exists for today", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 2 }], NOW);
      const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE, gracePeriodHours: 12 });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { card, button } = getHabitMetaElements(container);

      // then
      expect(card.classList.contains("is-done")).toBe(true);
      expect(button.classList.contains("is-done")).toBe(true);
    });

    it("respects block-level warning window override", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 26 }], NOW);
      const habitDefinition = buildHabitDefinition({
        title: HABIT_TITLE,
        gracePeriodHours: 24,
        warningWindowHours: 6,
      });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { last, streak } = getHabitMetaElements(container);

      // then
      const hint = streak.querySelector<HTMLSpanElement>(".time-left");
      expect(hint?.textContent).toBe(" <4h 🔥");
      expect(last.classList.contains("is-overdue")).toBe(true);
    });
  });

  describe("default threshold behavior", () => {
    it("follows default warning window when less than a day remains", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 30 }], NOW);
      const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { last, streak } = getHabitMetaElements(container);

      // then
      expect(last.classList.contains("is-overdue")).toBe(true);
      expect(streak.classList.contains("is-zero")).toBe(false);
      const timeLeft = streak.querySelector<HTMLSpanElement>(".time-left");
      expect(timeLeft).not.toBeNull();
      expect(timeLeft?.textContent).toBe(" <18h 🔥");
    });

    it("keeps streak healthy without warning for recent marks", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 10 }], NOW);
      const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { last, streak } = getHabitMetaElements(container);

      // then
      expect(last.classList.contains("is-overdue")).toBe(false);
      expect(streak.classList.contains("is-zero")).toBe(false);
      expect(streak.querySelector(".time-left")).toBeNull();
    });

    it("drops streak once the default window is exceeded but keeps warning", async () => {
      // given
      const plugin = await bootstrapPlugin();
      seedHabitEntries(plugin, HABIT_KEY, [{ hoursAgo: 60 }], NOW);
      const habitDefinition = buildHabitDefinition({ title: HABIT_TITLE });

      // when
      const container = await renderHabit(plugin, habitDefinition);
      const { last, streak } = getHabitMetaElements(container);

      // then
      expectStreakText(streak, "Streak: 0 days");
      expect(streak.classList.contains("is-zero")).toBe(true);
      expect(last.classList.contains("is-overdue")).toBe(true);
      expect(streak.querySelector(".time-left")).toBeNull();
    });
  });
});
