import type { PluginHarness } from "../harness";
import { formatHHMM, formatIsoDate } from "./time";

function normalizeTagPrefix(raw: string | undefined): string {
  const base = raw?.trim().toLowerCase() ?? "";
  if (!base) return "habit";
  const sanitized = base
    .replace(/[^a-zа-яё0-9_]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "habit";
}

export function formatHabitEntryLine(
  plugin: PluginHarness,
  habitKey: string,
  time: string,
): string {
  const prefix = normalizeTagPrefix(plugin.settings.tagPrefix);
  return `- #${prefix}_${habitKey} ${time}`;
}

interface SeedEntry {
  hoursAgo: number;
  rawLine?: string;
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
    const line = entry.rawLine ?? formatHabitEntryLine(plugin, habitKey, hhmm);
    const existing = plugin.vault.files.get(path) ?? "";
    const next = existing ? `${existing.trimEnd()}\n${line}\n` : `${line}\n`;
    plugin.vault.files.set(path, next);
  }
}
