import type { PluginHarness } from "../harness";
import { formatHHMM, formatIsoDate } from "./time";
import { formatDailyNoteName, normalizeDailyNoteFormat } from "../../src/habit-core";
import { DEFAULT_DAILY_NOTE_FORMAT } from "../../src/settings";

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
  hoursAgo?: number;
  isoDate?: string;
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
  const noteFormat = normalizeDailyNoteFormat(plugin.settings.dailyNoteFormat, DEFAULT_DAILY_NOTE_FORMAT);

  for (const entry of entries) {
    const baseDate = entry.isoDate
      ? new Date(`${entry.isoDate}T${formatHHMM(now)}:00${now.getTimezoneOffset() === 0 ? "Z" : ""}`)
      : new Date(now.getTime() - (entry.hoursAgo ?? 0) * 3600000);
    const isoDate = entry.isoDate ?? formatIsoDate(baseDate);
    const hhmm = formatHHMM(baseDate);
    const noteName = formatDailyNoteName(baseDate, noteFormat);
    const path = `${prefix}${noteName}.md`;
    const line = entry.rawLine ?? formatHabitEntryLine(plugin, habitKey, hhmm);
    const existing = plugin.vault.files.get(path) ?? "";
    const next = existing ? `${existing.trimEnd()}\n${line}\n` : `${line}\n`;
    plugin.vault.files.set(path, next);
  }
}
