import { parseYaml } from "obsidian";
import moment from "moment";
import type { TFile } from "obsidian";
import type { HabitButtonSettings } from "./settings";
import { DEFAULT_DAILY_NOTE_FORMAT } from "./settings";

export type HeatLayout = "grid" | "row";

export interface HabitBlockOptions {
  title?: string;
  group?: string;
  gracePeriodHours?: number;
  warningWindowHours?: number;
  icon?: string;
  heatLayout?: HeatLayout;
  weeks?: number;
  days?: number;
  cellSize?: number;
  cellGap?: number;
  dotSize?: number;
  dotGap?: number;
  border?: boolean;
}

export interface HabitGroupBlockOptions {
  title?: string;
  group?: string;
  habitsLocations?: string[];
  border?: boolean;
  icon?: string;
}

export const HABIT_BLOCK_OPTION_KEYS = [
  "title",
  "group",
  "gracePeriodHours",
  "warningWindowHours",
  "icon",
  "heatLayout",
  "weeks",
  "days",
  "cellSize",
  "cellGap",
  "dotSize",
  "dotGap",
  "border",
] as const;

export type HabitBlockOptionKey = (typeof HABIT_BLOCK_OPTION_KEYS)[number];

type ExpectTrue<T extends true> = T;
type NoMissingHabitBlockOptions = ExpectTrue<
  Exclude<keyof HabitBlockOptions, HabitBlockOptionKey> extends never ? true : false
>;
type NoExtraHabitBlockOptions = ExpectTrue<
  Exclude<HabitBlockOptionKey, keyof HabitBlockOptions> extends never ? true : false
>;

type _HabitBlockOptionKeysCheck = NoMissingHabitBlockOptions & NoExtraHabitBlockOptions;

export const HABIT_GROUP_OPTION_KEYS = [
  "title",
  "group",
  "habitsLocations",
  "border",
  "icon",
] as const;

export type HabitGroupOptionKey = (typeof HABIT_GROUP_OPTION_KEYS)[number];

type NoMissingHabitGroupOptions = ExpectTrue<
  Exclude<keyof HabitGroupBlockOptions, HabitGroupOptionKey> extends never ? true : false
>;
type NoExtraHabitGroupOptions = ExpectTrue<
  Exclude<HabitGroupOptionKey, keyof HabitGroupBlockOptions> extends never ? true : false
>;

type _HabitGroupOptionKeysCheck = NoMissingHabitGroupOptions & NoExtraHabitGroupOptions;

export interface ResolvedHabitOptions {
  title: string;
  normalizedTitle: string;
  group?: string;
  gracePeriodHours?: number;
  warningWindowHours: number;
  icon?: string;
  dailyFolder: string;
  dailyNoteFormat: string;
  heatLayout: HeatLayout;
  weeks: number;
  days: number;
  cellSize: number;
  cellGap: number;
  dotSize: number;
  dotGap: number;
  templatePath?: string;
  habitKey: string;
  habitTag: string;
  tagPrefix: string;
  border: boolean;
}

export interface HabitStats {
  countsByISO: Map<string, number>;
  hasByISO: Set<string>;
  lastTsByISO: Map<string, Date>;
  lastTs: Date | null;
  streak: number;
  allowedGapH: number;
  allowedGapMs: number;
  warningWindowHours: number;
}

export interface ResolveHabitOptionsContext {
  settings: HabitButtonSettings;
  defaults: HabitButtonSettings;
}

export interface CollectHabitStatsContext {
  vault: {
    getMarkdownFiles(): TFile[];
    cachedRead(file: TFile): Promise<string>;
  };
  tagPrefix: string;
  defaultGracePeriodHours: number;
  defaultWarningWindowHours: number;
}

interface HabitDayParts {
  y: number;
  mo: number;
  d: number;
}

export function normalizeDailyNoteFormat(format: string | undefined, fallback?: string): string {
  const candidate = (format ?? "").trim();
  const fallbackCandidate = (fallback ?? DEFAULT_DAILY_NOTE_FORMAT).trim();
  return candidate || fallbackCandidate || DEFAULT_DAILY_NOTE_FORMAT;
}

export function formatDailyNoteName(date: Date, format: string): string {
  const pattern = normalizeDailyNoteFormat(format);
  return moment(date).format(pattern);
}

export function parseDailyNoteName(name: string, format: string): HabitDayParts | null {
  const pattern = normalizeDailyNoteFormat(format);
  const parsed = moment(name, pattern, true);
  if (!parsed.isValid()) return null;
  return { y: parsed.year(), mo: parsed.month() + 1, d: parsed.date() };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function nowHHMM(now: Date): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export function ensureTrailingNewline(value: string): string {
  if (!value.endsWith("\n")) return `${value}\n`;
  return value;
}

export function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeTagPrefix(value: string): string {
  const base = value.trim().toLowerCase();
  if (!base) return "habit";
  const sanitized = base
    .replace(/[^a-zа-яё0-9_]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "habit";
}

export function clampPositive(value: number, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

export function toHabitKey(value: string): string {
  const lower = value.toLowerCase();
  return lower
    .replace(/\s+/g, "_")
    .replace(/[^a-zа-яё0-9_]/gi, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseHabitBlock(source: string): HabitBlockOptions {
  const trimmed = source.trim();
  if (!trimmed) return {};
  try {
    const parsed = parseYaml(trimmed);
    if (typeof parsed === "object" && parsed) return parsed as HabitBlockOptions;
    return {};
  } catch (error) {
    console.warn("Habit Button: failed to parse block", error);
    return {};
  }
}

export function resolveHabitOptions(
  raw: HabitBlockOptions,
  context: ResolveHabitOptionsContext,
): ResolvedHabitOptions | null {
  const { settings, defaults } = context;
  const title = raw.title ? normalizeWhitespace(String(raw.title)) : "";
  if (!title) return null;

  const normalizedTitle = capitalizeFirst(title);
  const layout = raw.heatLayout === "row" ? "row" : raw.heatLayout === "grid" ? "grid" : settings.defaultLayout;

  const weeks = Number.isFinite(raw.weeks) ? Math.max(1, Number(raw.weeks)) : settings.weeks;
  const days = Number.isFinite(raw.days) ? Math.max(1, Number(raw.days)) : settings.days;

  const settingsFolder = (settings.dailyFolder ?? defaults.dailyFolder).trim();
  const dailyFolder = settingsFolder ? trimSlashes(settingsFolder) : "";
  const dailyNoteFormat = normalizeDailyNoteFormat(settings.dailyNoteFormat, defaults.dailyNoteFormat);

  const templateCandidate = (settings.templatePath ?? "").trim();
  const templatePath = templateCandidate ? templateCandidate : undefined;

  const defaultCellSize = clampPositive(settings.defaultCellSize, defaults.defaultCellSize);
  const defaultCellGap = clampPositive(settings.defaultCellGap, defaults.defaultCellGap, 0);
  const defaultDotSize = clampPositive(settings.defaultDotSize, defaults.defaultDotSize);
  const defaultDotGap = clampPositive(settings.defaultDotGap, defaults.defaultDotGap, 0);
  const defaultWarningWindow = clampPositive(settings.defaultWarningWindowHours, defaults.defaultWarningWindowHours, 0);
  const defaultGrace = clampPositive(settings.defaultGracePeriodHours, defaults.defaultGracePeriodHours);

  const cellSize = Number.isFinite(raw.cellSize)
    ? clampPositive(Number(raw.cellSize), defaultCellSize)
    : defaultCellSize;
  const cellGap = Number.isFinite(raw.cellGap)
    ? clampPositive(Number(raw.cellGap), defaultCellGap, 0)
    : defaultCellGap;
  const dotSize = Number.isFinite(raw.dotSize)
    ? clampPositive(Number(raw.dotSize), defaultDotSize)
    : defaultDotSize;
  const dotGap = Number.isFinite(raw.dotGap)
    ? clampPositive(Number(raw.dotGap), defaultDotGap, 0)
    : defaultDotGap;

  const tagPrefix = normalizeTagPrefix(settings.tagPrefix ?? defaults.tagPrefix);
  const habitKey = toHabitKey(title);

  const gracePeriodHours = Number.isFinite(raw.gracePeriodHours)
    ? clampPositive(Number(raw.gracePeriodHours), defaultGrace)
    : defaultGrace;

  const warningWindowHours = Number.isFinite(raw.warningWindowHours)
    ? clampPositive(Number(raw.warningWindowHours), defaultWarningWindow, 0)
    : defaultWarningWindow;

  const group = raw.group ? normalizeWhitespace(String(raw.group)) : undefined;
  const border = typeof raw.border === "boolean" ? raw.border : true;

  return {
    title,
    normalizedTitle,
    group,
    icon: raw.icon,
    gracePeriodHours,
    warningWindowHours,
    dailyFolder,
    dailyNoteFormat,
    heatLayout: layout,
    weeks,
    days,
    cellSize,
    cellGap,
    dotSize,
    dotGap,
    templatePath,
    habitKey,
    tagPrefix,
    habitTag: `#${tagPrefix}_${habitKey}`,
    border,
  };
}

export function makeLocalDate(y: number, mo: number, d: number, hh = 0, mm = 0): Date {
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

export function isoOf(y: number, mo: number, d: number): string {
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

export function today0(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function sortDatesAscending(list: Iterable<Date>): Date[] {
  return Array.from(list).sort((a, b) => a.getTime() - b.getTime());
}

export function computeStreakByDays(days: Date[], allowedGapMs: number): number {
  if (!days.length) return 0;
  const now = Date.now();
  const last = days[days.length - 1];
  if (now - last.getTime() > allowedGapMs) return 0;

  let streak = 1;
  for (let i = days.length - 2; i >= 0; i--) {
    if (days[i + 1].getTime() - days[i].getTime() <= allowedGapMs) streak++;
    else break;
  }
  return streak;
}

export async function collectHabitStats(
  options: ResolvedHabitOptions,
  context: CollectHabitStatsContext,
): Promise<HabitStats> {
  const countsByISO = new Map<string, number>();
  const hasByISO = new Set<string>();
  const lastTsByISO = new Map<string, Date>();

  const folder = trimSlashes(options.dailyFolder);
  const folderPrefix = folder ? `${folder}/` : "";

  const files = context.vault
    .getMarkdownFiles()
    .filter((file) => (folder ? file.path.startsWith(folderPrefix) : true));

  const habitRegex = new RegExp(
    `${escapeRegExp(`#${context.tagPrefix}_`)}([^\\s#]+)(?:\\s+(\\d{1,2}:\\d{2}))?`,
    "gim",
  );
  const needle = options.habitKey.toLowerCase();

  for (const file of files) {
    const withoutExt = file.path.replace(/\.md$/i, "");
    const relativePath = folder ? withoutExt.slice(folderPrefix.length) : withoutExt;
    let day = parseDailyNoteName(relativePath, options.dailyNoteFormat);
    if (!day && !folder) {
      day = parseDailyNoteName(file.basename, options.dailyNoteFormat);
    }
    if (!day) continue;

    const content = await context.vault.cachedRead(file);
    if (!content) continue;

    let match: RegExpExecArray | null;
    while ((match = habitRegex.exec(content)) !== null) {
      const key = match[1]?.trim().toLowerCase();
      if (key !== needle) continue;

      const timeRaw = match[2]?.trim() ?? "00:00";
      const [hh, mm] = timeRaw.split(":").map((value) => parseInt(value, 10));
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;

      const timestamp = makeLocalDate(day.y, day.mo, day.d, hh, mm);
      const iso = isoOf(day.y, day.mo, day.d);

      countsByISO.set(iso, (countsByISO.get(iso) ?? 0) + 1);
      hasByISO.add(iso);

      const previous = lastTsByISO.get(iso);
      if (!previous || timestamp > previous) {
        lastTsByISO.set(iso, timestamp);
      }
    }
  }

  const baseThreshold = Number.isFinite(options.gracePeriodHours)
    ? Math.max(1, Number(options.gracePeriodHours))
    : context.defaultGracePeriodHours;
  const warningWindow = Math.max(0, Math.round(options.warningWindowHours ?? context.defaultWarningWindowHours));
  const allowedGapH = baseThreshold + warningWindow;
  const allowedGapMs = allowedGapH * 3600000;

  const dayTimestamps = sortDatesAscending(lastTsByISO.values());
  const lastTs = dayTimestamps.length ? dayTimestamps[dayTimestamps.length - 1] : null;
  const streak = computeStreakByDays(dayTimestamps, allowedGapMs);

  return {
    countsByISO,
    hasByISO,
    lastTsByISO,
    lastTs,
    streak,
    allowedGapH,
    allowedGapMs,
    warningWindowHours: warningWindow,
  };
}

export function cloneHabitStats(stats: HabitStats): HabitStats {
  return {
    countsByISO: new Map(stats.countsByISO),
    hasByISO: new Set(stats.hasByISO),
    lastTsByISO: new Map(
      Array.from(stats.lastTsByISO.entries()).map(([iso, date]) => [iso, new Date(date)]),
    ),
    lastTs: stats.lastTs ? new Date(stats.lastTs) : null,
    streak: stats.streak,
    allowedGapH: stats.allowedGapH,
    allowedGapMs: stats.allowedGapMs,
    warningWindowHours: stats.warningWindowHours,
  };
}
