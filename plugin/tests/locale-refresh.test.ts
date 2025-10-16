import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { bootstrapPlugin } from "./harness";
import { getLocale } from "../src/i18n";

describe("locale refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies explicit ru locale", async () => {
    // given
    const plugin = await bootstrapPlugin();

    // when
    plugin.settings.locale = "ru";
    plugin.refreshLocale();

    // then
    expect(getLocale()).toBe("ru");
  });

  it("applies explicit uk locale", async () => {
    // given
    const plugin = await bootstrapPlugin();

    // when
    plugin.settings.locale = "ua";
    plugin.refreshLocale();

    // then
    expect(getLocale()).toBe("ua");
  });

  it("resolves auto locale from navigator", async () => {
    // given
    const plugin = await bootstrapPlugin();
    plugin.settings.locale = "auto";
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { language: "ru-RU" },
    });

    // when
    plugin.refreshLocale();

    // then
    expect(getLocale()).toBe("ru");

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });
});
