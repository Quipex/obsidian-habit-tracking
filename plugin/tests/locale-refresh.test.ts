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

  it("resolves auto locale from app and navigator", async () => {
    // given
    const plugin = await bootstrapPlugin();
    plugin.settings.locale = "auto";
    (plugin.app as any).locale = "ru-RU";
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { language: "en-US" },
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
