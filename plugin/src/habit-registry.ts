import { cloneHabitStats } from "./habit-core";
import type { HabitStats, ResolvedHabitOptions } from "./habit-core";

export interface HabitRegistryRecord {
  habitKey: string;
  group?: string;
  sourcePath: string;
  options: ResolvedHabitOptions;
  stats: HabitStats;
  updatedAt: number;
}

export interface HabitRegistryUpsertInput {
  habitKey: string;
  group?: string;
  sourcePath: string;
  options: ResolvedHabitOptions;
  stats: HabitStats;
}

interface InternalRegistryEntry extends HabitRegistryRecord {
  fingerprint: string;
}

function fingerprintEntry(entry: HabitRegistryUpsertInput): string {
  const { options, stats } = entry;
  const counts = Array.from(stats.countsByISO.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const hasMarks = Array.from(stats.hasByISO.values()).sort((a, b) => a.localeCompare(b));
  const lastMap = Array.from(stats.lastTsByISO.entries())
    .map(([iso, date]) => [iso, date.getTime()] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const lastTs = stats.lastTs ? stats.lastTs.getTime() : null;

  const optionShape = {
    group: entry.group ?? null,
    dailyFolder: options.dailyFolder,
    heatLayout: options.heatLayout,
    weeks: options.weeks,
    days: options.days,
    cellSize: options.cellSize,
    cellGap: options.cellGap,
    dotSize: options.dotSize,
    dotGap: options.dotGap,
    warningWindowHours: options.warningWindowHours,
    gracePeriodHours: options.gracePeriodHours ?? null,
    templatePath: options.templatePath ?? null,
    icon: options.icon ?? null,
    tagPrefix: options.tagPrefix,
  };

  const statsShape = {
    streak: stats.streak,
    allowedGapH: stats.allowedGapH,
    allowedGapMs: stats.allowedGapMs,
    warningWindowHours: stats.warningWindowHours,
    counts,
    hasMarks,
    lastMap,
    lastTs,
  };

  return JSON.stringify({ optionShape, statsShape });
}

function cloneRecord(entry: InternalRegistryEntry): HabitRegistryRecord {
  return {
    habitKey: entry.habitKey,
    group: entry.group,
    sourcePath: entry.sourcePath,
    options: { ...entry.options },
    stats: cloneHabitStats(entry.stats),
    updatedAt: entry.updatedAt,
  };
}

export class HabitRegistry {
  private records: Map<string, Map<string, InternalRegistryEntry>> = new Map();

  upsert(input: HabitRegistryUpsertInput): { changed: boolean; record: HabitRegistryRecord } {
    const statsSnapshot = cloneHabitStats(input.stats);
    const entry: InternalRegistryEntry = {
      habitKey: input.habitKey,
      group: input.group,
      sourcePath: input.sourcePath,
      options: { ...input.options },
      stats: statsSnapshot,
      updatedAt: Date.now(),
      fingerprint: fingerprintEntry(input),
    };

    let perKey = this.records.get(input.habitKey);
    if (!perKey) {
      perKey = new Map();
      this.records.set(input.habitKey, perKey);
    }

    const existing = perKey.get(input.sourcePath);
    perKey.set(input.sourcePath, entry);

    const changed = !existing || existing.fingerprint !== entry.fingerprint;

    return { changed, record: cloneRecord(entry) };
  }

  remove(habitKey: string, sourcePath: string): HabitRegistryRecord | null {
    const perKey = this.records.get(habitKey);
    if (!perKey) return null;
    const existing = perKey.get(sourcePath);
    if (!existing) return null;
    perKey.delete(sourcePath);
    if (perKey.size === 0) {
      this.records.delete(habitKey);
    }
    return cloneRecord(existing);
  }

  clear(): void {
    this.records.clear();
  }

  pruneSourceRecords(sourcePath: string, group: string | undefined, keep: Set<string>): HabitRegistryRecord[] {
    const targetGroup = group?.trim().toLowerCase() ?? "";
    const removed: HabitRegistryRecord[] = [];
    for (const [habitKey, perKey] of this.records.entries()) {
      const existing = perKey.get(sourcePath);
      if (!existing) continue;
      const entryGroup = (existing.group ?? "").trim().toLowerCase();
      if (targetGroup && entryGroup !== targetGroup) continue;
      if (keep.has(habitKey)) continue;
      removed.push(cloneRecord(existing));
      perKey.delete(sourcePath);
      if (perKey.size === 0) {
        this.records.delete(habitKey);
      }
    }
    return removed;
  }

  getAll(): HabitRegistryRecord[] {
    const results: HabitRegistryRecord[] = [];
    for (const perKey of this.records.values()) {
      for (const entry of perKey.values()) {
        results.push(cloneRecord(entry));
      }
    }
    return results;
  }

  getByGroup(group: string): HabitRegistryRecord[] {
    const normalized = group.trim().toLowerCase();
    if (!normalized) return [];
    const results: HabitRegistryRecord[] = [];
    for (const perKey of this.records.values()) {
      for (const entry of perKey.values()) {
        if ((entry.group ?? "").toLowerCase() === normalized) {
          results.push(cloneRecord(entry));
        }
      }
    }
    return results;
  }

  getDuplicates(): Map<string, HabitRegistryRecord[]> {
    const duplicates = new Map<string, HabitRegistryRecord[]>();
    for (const [habitKey, perKey] of this.records.entries()) {
      if (perKey.size > 1) {
        duplicates.set(
          habitKey,
          Array.from(perKey.values()).map((entry) => cloneRecord(entry)),
        );
      }
    }
    return duplicates;
  }

  size(): number {
    let count = 0;
    for (const perKey of this.records.values()) {
      count += perKey.size;
    }
    return count;
  }
}

export default HabitRegistry;
