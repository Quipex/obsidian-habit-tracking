import type { PluginHarness } from "../harness";
import { formatHHMM, formatIsoDate } from "./time";

interface SeedEntry {
  hoursAgo: number;
}

export function seedHabitEntries(
  plugin: PluginHarness,
  habitKey: string,
  entries: SeedEntry[],
  now: Date,
): void {
  const folder = plugin.settings.dailyFolder?.trim();
  const prefix = folder ? `${folder.replace(/^\/+|\/+$/g, "")}/` : "";

  for (const entry of entries) {
    const timestamp = new Date(now.getTime() - entry.hoursAgo * 3600000);
    const isoDate = formatIsoDate(timestamp);
    const hhmm = formatHHMM(timestamp);
    const path = `${prefix}${isoDate}.md`;
    const line = `- #habit_${habitKey} ${hhmm}`;
    const existing = plugin.vault.files.get(path) ?? "";
    const next = existing ? `${existing.trimEnd()}\n${line}\n` : `${line}\n`;
    plugin.vault.files.set(path, next);
  }
}
