import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin, flushPromises, getTodayPath } from "./harness";
import { renderHabit } from "./utils/habit-block";
import { getHabitMetaElements } from "./utils/meta-elements";
import { seedHabitEntries } from "./utils/habit-fixtures";

const NOW = new Date("2024-06-15T12:00:00Z");

describe("resolveOptions behaviour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders error when title is missing", async () => {
    // given
    const plugin = await bootstrapPlugin();

    // when
    const container = await renderHabit(plugin, "");

    // then
    const error = container.querySelector("pre");
    expect(error?.textContent).toBe("[habit-button] Title is required");
  });

  it("honours block layout overrides while using settings daily folder", async () => {
    // given
    const plugin = await bootstrapPlugin({ dailyFolder: " rituals/ " });
    const habitDefinition = [
      "title: Evening Stretch",
      "heatLayout: row",
      "days: 5",
    ].join("\n");

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const heat = container.querySelector<HTMLDivElement>(".dv-habit-heat-row");
    expect(heat).not.toBeNull();
    expect(heat?.children.length).toBe(5);

    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button).not.toBeNull();

    button!.click();
    await flushPromises();

    const expectedPath = getTodayPath("rituals");
    expect(plugin.vault.files.has(expectedPath)).toBe(true);
  });

  it("clamps invalid numeric values and falls back to defaults", async () => {
    // given
    const plugin = await bootstrapPlugin({
      defaultCellSize: 11,
      defaultCellGap: 4,
      defaultDotSize: 9,
      defaultDotGap: 5,
      defaultGracePeriodHours: 24,
      defaultWarningWindowHours: 5,
      weeks: 8,
    });
    seedHabitEntries(plugin, "clamp_case", [{ hoursAgo: 26 }], NOW);

    const habitDefinition = [
      "title: Clamp Case",
      "heatLayout: grid",
      "weeks: 0",
      "cellSize: 0",
      "cellGap: -5",
      "dotSize: -2",
      "dotGap: -4",
      "gracePeriodHours: 24",
      "warningWindowHours: invalid",
    ].join("\n");

    // when
    const container = await renderHabit(plugin, habitDefinition);

    // then
    const card = container.querySelector<HTMLDivElement>(".dv-habit-card");
    expect(card).not.toBeNull();
    expect(card?.style.getPropertyValue("--habit-cell-size")).toBe("1px");
    expect(card?.style.getPropertyValue("--habit-cell-gap")).toBe("0px");
    expect(card?.style.getPropertyValue("--habit-dot-size")).toBe("1px");
    expect(card?.style.getPropertyValue("--habit-dot-gap")).toBe("0px");

    const columns = container.querySelectorAll<HTMLDivElement>(".dv-habit-heat-grid .dv-habit-col");
    expect(columns.length).toBe(1);
    expect(columns[0].children.length).toBe(7);

    const { streak } = getHabitMetaElements(container);
    const hint = streak.querySelector<HTMLSpanElement>(".time-left");
    expect(hint?.textContent).toBe(" <3h 🔥");
  });

  it("trims template path before creating a note", async () => {
    // given
    const plugin = await bootstrapPlugin({ templatePath: "  templates/daily.md  " });
    plugin.vault.files.set("templates/daily.md", "Template body");
    const habitDefinition = ["title: Template Test"].join("\n");

    const container = await renderHabit(plugin, habitDefinition);
    const button = container.querySelector<HTMLButtonElement>(".dv-habit-iconbtn");
    expect(button).not.toBeNull();

    // when
    button!.click();
    await flushPromises();

    // then
    const expectedPath = getTodayPath(plugin.settings.dailyFolder);
    const content = plugin.vault.files.get(expectedPath);
    expect(content).toContain("Template body\n");
    expect(content).toMatch(/Template body\n\n- #habit_template_test \d{2}:\d{2}\n/);
  });
});
