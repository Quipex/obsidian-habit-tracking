import {
  Editor,
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  Notice,
  Plugin,
  TFile,
  parseYaml,
} from "obsidian";
import {
  DEFAULT_SETTINGS,
  HabitButtonSettingTab,
  HabitButtonSettings,
} from "./settings";
import { applyLocale, t } from "./i18n";
import styles from "../styles.css";
import {
  clampPositive,
  collectHabitStats,
  computeStreakByDays,
  ensureTrailingNewline,
  isoOf,
  nowHHMM,
  pad2,
  parseHabitBlock,
  resolveHabitOptions,
  sortDatesAscending,
  today0,
  trimSlashes,
  cloneHabitStats,
  capitalizeFirst,
} from "./habit-core";
import type { HabitStats, ResolvedHabitOptions } from "./habit-core";
import HabitRegistry, { HabitRegistryRecord } from "./habit-registry";
import HabitEventBus from "./habit-event-bus";

function humanAgoShort(ts: Date | null): string {
  if (!ts) return "—";
  const diffMs = Date.now() - ts.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;

  if (days === 0 && hours < 1) {
    return mins < 2 ? t("meta.justNow") : t("meta.minutesAgo", minutes);
  }
  if (days === 0) {
    return t("meta.hoursAgo", hours);
  }
  if (days < 2) {
    return t("meta.hoursAgo", days * 24 + hours);
  }
  return t("meta.daysAgo", days);
}

interface HabitGroupBlockOptions {
  title?: string;
  group?: string;
  habitsLocations?: string[];
  eagerScan?: boolean;
  border?: boolean;
}

export default class HabitButtonPlugin extends Plugin {
  settings: HabitButtonSettings = DEFAULT_SETTINGS;
  private styleEl: HTMLStyleElement | null = null;
  private registry = new HabitRegistry();
  private anonymousSourceCounter = 0;
  private stalePaths = new Set<string>();
  private groupScanCache = new Map<string, Set<string>>();
  private events = new HabitEventBus();

  getHabitRegistry(): HabitRegistry {
    return this.registry;
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.refreshLocale();

    this.registerMarkdownCodeBlockProcessor(
      "habit-button",
      (source, el, ctx) => this.renderHabitButton(source, el, ctx),
    );

    this.registerMarkdownCodeBlockProcessor(
      "habit-group",
      (source, el, ctx) => {
        void this.renderHabitGroup(source, el, ctx);
      },
    );

    const metadataCache = (this.app as any)?.metadataCache;
    if (metadataCache?.on) {
      this.registerEvent(
        metadataCache.on("changed", (file: { path?: string } | string) => {
          const path = typeof file === "string" ? file : file?.path;
          if (path) this.markPathStale(path);
        }),
      );
    }

    this.addCommand({
      id: "habit-button-insert-block",
      name: t("commands.insertBlock"),
      editorCallback: (editor: Editor) => {
        const cursor = editor.getCursor();
        const defaultLayout = this.settings.defaultLayout || DEFAULT_SETTINGS.defaultLayout;
        const snippet = [
          "```habit-button",
          `title: ${t("snippet.title")}`,
          `heatLayout: ${defaultLayout}`,
          t("snippet.heatLayoutComment"),
          "```",
          "",
        ].join("\n");
        editor.replaceRange(snippet, cursor);
      },
    });

    this.addSettingTab(new HabitButtonSettingTab(this.app, this));

    this.injectStyles();
  }

  onunload(): void {
    this.disposeStyles();
    this.registry.clear();
    this.anonymousSourceCounter = 0;
    this.events.clear();
    this.stalePaths.clear();
    this.groupScanCache.clear();
  }

  private injectStyles(): void {
    if (this.styleEl) return;
    const style = document.createElement("style");
    style.id = "habit-button-styles";
    style.textContent = styles;
    document.head.appendChild(style);
    this.styleEl = style;
    this.register(() => this.disposeStyles());
  }

  private disposeStyles(): void {
    if (this.styleEl?.parentElement) {
      this.styleEl.parentElement.removeChild(this.styleEl);
    }
    this.styleEl = null;
  }

  refreshLocale(): void {
    const preference = this.settings.locale;
    const candidates: Array<string | undefined> = [
      preference === "auto" ? undefined : preference,
      (this.app as any)?.vault?.getConfig?.("locale"),
      (this.app as any)?.locale,
      typeof navigator !== "undefined" ? navigator.language : undefined,
    ];
    applyLocale(preference, candidates);
  }


  private renderError(el: HTMLElement, message: string): void {
    el.empty();
    el.createEl("pre", { text: message });
  }

  private applyLayoutStyles(container: HTMLElement, options: ResolvedHabitOptions): void {
    container.style.setProperty("--habit-cell-size", `${options.cellSize}px`);
    container.style.setProperty("--habit-cell-gap", `${options.cellGap}px`);
    container.style.setProperty("--habit-dot-size", `${options.dotSize}px`);
    container.style.setProperty("--habit-dot-gap", `${options.dotGap}px`);
  }

  private createStatsContext(tagPrefix: string) {
    return {
      vault: this.app.vault,
      tagPrefix,
      defaultGracePeriodHours: clampPositive(
        this.settings.defaultGracePeriodHours,
        DEFAULT_SETTINGS.defaultGracePeriodHours,
      ),
      defaultWarningWindowHours: clampPositive(
        this.settings.defaultWarningWindowHours,
        DEFAULT_SETTINGS.defaultWarningWindowHours,
        0,
      ),
    } as const;
  }

  private registerGroupListener(group: string, listener: () => void): () => void {
    return this.events.onGroup(group, listener);
  }

  private notifyGroupListeners(group?: string | null): void {
    this.events.emitGroup(group ?? null);
  }

  private markPathStale(path: string): void {
    if (!path) return;
    this.stalePaths.add(path);
    this.groupScanCache.delete(path);
  }

  private shouldScanPath(path: string, normalizedGroup: string, force: boolean): boolean {
    if (force) return true;
    if (this.stalePaths.has(path)) return true;
    const groups = this.groupScanCache.get(path);
    if (!groups) return true;
    return !groups.has(normalizedGroup);
  }

  private markGroupScanFresh(path: string, normalizedGroup: string): void {
    let groups = this.groupScanCache.get(path);
    if (!groups) {
      groups = new Set();
      this.groupScanCache.set(path, groups);
    }
    groups.add(normalizedGroup);
    this.stalePaths.delete(path);
  }

  private resolveSourcePath(candidate: string | undefined): string {
    const trimmed = candidate?.trim();
    if (trimmed && trimmed.length > 0) return trimmed;
    this.anonymousSourceCounter += 1;
    return `__unknown__/${this.anonymousSourceCounter}`;
  }

  private registerBlockCleanup(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext | undefined,
    habitKey: string,
    sourcePath: string,
  ): void {
    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      const removed = this.registry.remove(habitKey, sourcePath);
      this.notifyGroupListeners(removed?.group);
    };

    if (ctx && typeof ctx.addChild === "function") {
      ctx.addChild(new DisposableRenderChild(el, dispose));
    }

    this.register(() => dispose());
  }

  private renderHabitButton(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): void {
    const blockOptions = parseHabitBlock(source);
    const options = resolveHabitOptions(blockOptions, {
      settings: this.settings,
      defaults: DEFAULT_SETTINGS,
    });

    if (!options) {
      this.renderError(el, t("ui.errorNoTitle"));
      return;
    }

    const effectiveBorder =
      typeof blockOptions.border === "boolean" ? blockOptions.border : this.settings.defaultBorder;
    options.border = effectiveBorder;

    const sourcePath = this.resolveSourcePath(ctx?.sourcePath);
    this.registerBlockCleanup(el, ctx, options.habitKey, sourcePath);

    void this.mountHabitButton(el, options, { sourcePath });
  }

  private async mountHabitButton(
    el: HTMLElement,
    options: ResolvedHabitOptions,
    context: { sourcePath: string },
  ): Promise<void> {
    const stats = await collectHabitStats(options, this.createStatsContext(options.tagPrefix));

    const firstUpsert = this.registry.upsert({
      habitKey: options.habitKey,
      group: options.group,
      sourcePath: context.sourcePath,
      options,
      stats: cloneHabitStats(stats),
    });
    if (firstUpsert.changed) {
      this.notifyGroupListeners(firstUpsert.record.group);
    }

    el.empty();
    const card = el.createDiv({ cls: "dv-habit-card" });
    card.classList.toggle("has-border", options.border !== false);
    card.classList.toggle("is-borderless", options.border === false);
    const iconBtn = card.createEl("button", {
      cls: "dv-habit-iconbtn",
      text: options.icon || "✅",
      attr: { title: t("ui.markHabit", options.normalizedTitle) },
    });

    const right = card.createDiv({ cls: "dv-habit-right" });
    const titleRow = right.createDiv();
    titleRow.createDiv({ cls: "dv-habit-title", text: options.normalizedTitle });

    const heat = right.createDiv({ cls: "dv-habit-heat-row" });
    const meta = right.createDiv({ cls: "dv-habit-meta" });
    const lastEl = meta.createSpan({ cls: "last" });
    meta.createSpan({ cls: "bullet", text: "•" });
    const streakEl = meta.createSpan({ cls: "streak" });

    this.applyLayoutStyles(card, options);

    const state = {
      options,
      stats,
      heat,
      meta: { lastEl, streakEl },
      card,
      iconBtn,
      sourcePath: context.sourcePath,
    };

    const renderHeat = () => {
      if (options.heatLayout === "grid") this.renderHeatGrid(state);
      else this.renderHeatRow(state);
    };

    const renderMeta = () => {
      const { stats: currentStats } = state;
      const { lastEl: lastElement, streakEl: streakElement } = state.meta;

      lastElement.textContent = humanAgoShort(currentStats.lastTs);
      const hoursSinceLast = currentStats.lastTs
        ? (Date.now() - currentStats.lastTs.getTime()) / 3600000
        : Infinity;
      const isStreakAlive = currentStats.streak > 0;
      const hasLastMark = currentStats.lastTs !== null;
      const remainingHours = Number.isFinite(hoursSinceLast)
        ? currentStats.allowedGapH - hoursSinceLast
        : Infinity;
      const isStreakBroken = hasLastMark && !isStreakAlive;
      const warnWindow = currentStats.warningWindowHours;
      const shouldWarn =
        (isStreakAlive && remainingHours > 0 && remainingHours <= warnWindow) ||
        (isStreakBroken && Number.isFinite(hoursSinceLast));
      lastElement.classList.toggle("is-overdue", shouldWarn);

      const streakText =
        currentStats.streak > 0
          ? t("meta.streak", currentStats.streak)
          : t("meta.streakZero");
      streakElement.textContent = streakText;
      streakElement.classList.toggle("is-zero", currentStats.streak === 0);

      const remH = remainingHours;
      if (currentStats.streak > 0 && remH > 0 && remH <= warnWindow) {
        const hint = streakElement.createSpan({ cls: "time-left" });
        const hrs = Math.ceil(remH);
        hint.textContent = ` ${t("overdue.label", hrs)}`;
      }
    };

    const refresh = () => {
      renderHeat();
      renderMeta();
      const today = today0();
      const isoToday = isoOf(today.getFullYear(), today.getMonth() + 1, today.getDate());
      const doneToday = state.stats.hasByISO.has(isoToday);
      card.classList.toggle("is-done", doneToday);
      iconBtn.classList.toggle("is-done", doneToday);
      iconBtn.textContent = doneToday ? "✓" : options.icon || "✅";
      iconBtn.setAttribute("aria-pressed", doneToday ? "true" : "false");
    };

    refresh();

    iconBtn.addEventListener("click", async () => {
      try {
        const timestamp = await this.logHabitEntry(options);
        if (!timestamp) return;

        const iso = isoOf(
          timestamp.getFullYear(),
          timestamp.getMonth() + 1,
          timestamp.getDate(),
        );

        state.stats.countsByISO.set(
          iso,
          (state.stats.countsByISO.get(iso) ?? 0) + 1,
        );
        state.stats.hasByISO.add(iso);
        state.stats.lastTsByISO.set(iso, timestamp);

        const sorted = sortDatesAscending(state.stats.lastTsByISO.values());
        state.stats.lastTs = sorted.length ? sorted[sorted.length - 1] : null;
        state.stats.streak = computeStreakByDays(sorted, state.stats.allowedGapMs);

        const update = this.registry.upsert({
          habitKey: options.habitKey,
          group: options.group,
          sourcePath: state.sourcePath,
          options,
          stats: cloneHabitStats(state.stats),
        });
        if (update.changed) {
          this.notifyGroupListeners(update.record.group);
        }

        refresh();
      } catch (error) {
        console.error("[habit-button] append error", error);
        new Notice(t("ui.noticeError"), 4000);
      }
    });
  }

  private parseHabitGroupBlock(source: string): HabitGroupBlockOptions {
    const trimmed = source.trim();
    if (!trimmed) return {};
    try {
      const parsed = parseYaml(trimmed);
      if (!parsed || typeof parsed !== "object") return {};
      const data = parsed as Record<string, unknown>;
      const toStringArray = (value: unknown): string[] | undefined => {
        if (Array.isArray(value)) {
          const list = value
            .map((entry) => (typeof entry === "string" ? entry : entry != null ? String(entry) : ""))
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
          return list.length ? list : undefined;
        }
        if (typeof value === "string") {
          const trimmedValue = value.trim();
          return trimmedValue ? [trimmedValue] : undefined;
        }
        return undefined;
      };

      return {
        title: typeof data.title === "string" ? data.title : undefined,
        group: typeof data.group === "string" ? data.group : undefined,
        habitsLocations: toStringArray((data as any).habitsLocations),
        eagerScan: typeof data.eagerScan === "boolean" ? data.eagerScan : undefined,
        border: typeof (data as any).border === "boolean" ? (data as any).border : undefined,
      };
    } catch (error) {
      console.warn("Habit Group: failed to parse block", error);
      return {};
    }
  }

  private async renderHabitGroup(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void> {
    const rawOptions = this.parseHabitGroupBlock(source);
    const groupRaw = rawOptions.group?.trim();
    if (!groupRaw) {
      this.renderError(el, t("ui.errorGroupMissing"));
      return;
    }

    const groupLabel = rawOptions.title?.trim() || capitalizeFirst(groupRaw);
    const normalizedGroup = groupRaw.trim().toLowerCase();
    const sourcePath = this.resolveSourcePath(ctx?.sourcePath);

    el.empty();
    const container = el.createDiv({ cls: "dv-habit-group" });
    const borderEnabled =
      typeof rawOptions.border === "boolean" ? rawOptions.border : this.settings.defaultBorder;
    container.classList.toggle("has-border", borderEnabled);
    container.classList.toggle("is-borderless", !borderEnabled);

    const render = async () => {
      container.empty();
      container.createDiv({ cls: "dv-habit-group-title", text: groupLabel });

      let records = this.registry.getByGroup(groupRaw);
      const needsScan = Boolean(rawOptions.eagerScan || records.length === 0);

      if (needsScan) {
        const locations = this.resolveHabitGroupLocations(rawOptions, sourcePath);
        if (locations.length) {
          await this.scanHabitGroupLocations(
            groupRaw,
            normalizedGroup,
            locations,
            Boolean(rawOptions.eagerScan),
          );
          records = this.registry.getByGroup(groupRaw);
        }
      }

      const duplicates = this.collectGroupDuplicates(normalizedGroup);
      if (duplicates.length > 0) {
        this.renderGroupDuplicates(container, duplicates, sourcePath);
        return;
      }

      if (records.length === 0) {
        const message = rawOptions.eagerScan
          ? t("group.emptyEager")
          : t("group.emptyPassive");
        container.createDiv({ cls: "dv-habit-group-empty", text: message });
        return;
      }

      const active = records.filter((record) => record.stats.streak > 0).length;
      const total = records.length;
      this.renderGroupSummary(container, active, total);
    };

    await render();

    const unregister = this.registerGroupListener(groupRaw, () => {
      void render();
    });

    const cleanup = new DisposableRenderChild(container, () => unregister());
    if (ctx && typeof ctx.addChild === "function") {
      ctx.addChild(cleanup);
    } else {
      cleanup.onload();
      this.register(() => cleanup.onunload());
    }
  }

  private resolveHabitGroupLocations(
    options: HabitGroupBlockOptions,
    fallbackPath: string,
  ): string[] {
    const unique = new Set<string>();
    const push = (value: string | undefined) => {
      if (!value) return;
      const trimmed = trimSlashes(value.trim());
      if (trimmed) unique.add(trimmed);
    };

    if (options.habitsLocations?.length) {
      for (const item of options.habitsLocations) {
        push(item);
      }
    } else if (!fallbackPath.startsWith("__unknown__")) {
      push(fallbackPath);
    }

    return Array.from(unique);
  }

  private async scanHabitGroupLocations(
    groupRaw: string,
    normalizedGroup: string,
    locations: string[],
    force: boolean,
  ): Promise<void> {
    const markdownFiles = (this.app.vault.getMarkdownFiles() as TFile[]) ?? [];
    const filesByPath = new Map(markdownFiles.map((file) => [file.path, file] as const));

    for (const location of locations) {
      const resolvedPaths = this.resolveLocationPaths(location, markdownFiles);
      for (const path of resolvedPaths) {
        const file = filesByPath.get(path);
        if (!file) continue;
        if (!this.shouldScanPath(file.path, normalizedGroup, force)) continue;
        await this.scanHabitFileForGroup(file, groupRaw, normalizedGroup);
      }
    }
  }

  private resolveLocationPaths(location: string, markdownFiles: TFile[]): string[] {
    const normalized = trimSlashes(location);
    if (!normalized) return [];

    const directChildren = markdownFiles
      .filter((file) => {
        if (!file.path.startsWith(`${normalized}/`)) return false;
        const rest = file.path.slice(normalized.length + 1);
        return rest.length > 0 && !rest.includes("/");
      })
      .map((file) => file.path);
    if (directChildren.length) return directChildren;

    const exact = markdownFiles.find((file) => file.path === normalized);
    if (exact) return [exact.path];

    const withMd = markdownFiles.find((file) => file.path === `${normalized}.md`);
    if (withMd) return [withMd.path];

    const dotIndex = normalized.lastIndexOf(".");
    const hasExtension = dotIndex > normalized.lastIndexOf("/");
    if (!hasExtension) {
      const alternatives = markdownFiles
        .filter((file) => file.path.startsWith(`${normalized}.`))
        .sort((a, b) => a.path.localeCompare(b.path));
      if (alternatives.length) {
        return [alternatives[0].path];
      }
    }

    return [];
  }

  private async scanHabitFileForGroup(
    file: TFile,
    groupRaw: string,
    normalizedGroup: string,
  ): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    const blocks = this.extractHabitButtonBlocks(content ?? "");
    if (!blocks.length) {
      const removed = this.registry.pruneSourceRecords(file.path, groupRaw, new Set());
      for (const record of removed) {
        this.notifyGroupListeners(record.group);
      }
      this.markGroupScanFresh(file.path, normalizedGroup);
      return;
    }

    const keep = new Set<string>();
    for (const block of blocks) {
      const rawOptions = parseHabitBlock(block);
      const resolved = resolveHabitOptions(rawOptions, {
        settings: this.settings,
        defaults: DEFAULT_SETTINGS,
      });
      if (!resolved) continue;
      const blockGroup = resolved.group?.trim().toLowerCase();
      if (!blockGroup || blockGroup !== normalizedGroup) continue;

      keep.add(resolved.habitKey);
      const stats = await collectHabitStats(resolved, this.createStatsContext(resolved.tagPrefix));
      const result = this.registry.upsert({
        habitKey: resolved.habitKey,
        group: resolved.group ?? groupRaw,
        sourcePath: file.path,
        options: resolved,
        stats: cloneHabitStats(stats),
      });
      if (result.changed) {
        this.notifyGroupListeners(result.record.group);
      }
    }

    const removed = this.registry.pruneSourceRecords(file.path, groupRaw, keep);
    for (const record of removed) {
      this.notifyGroupListeners(record.group);
    }
    this.markGroupScanFresh(file.path, normalizedGroup);
  }

  private extractHabitButtonBlocks(content: string): string[] {
    if (!content) return [];
    const pattern = /```habit-button[^\n]*\n([\s\S]*?)```/g;
    const blocks: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const body = match[1]?.trim() ?? "";
      if (body) blocks.push(body);
    }
    return blocks;
  }

  private collectGroupDuplicates(
    normalizedGroup: string,
  ): Array<{ habitKey: string; records: HabitRegistryRecord[] }> {
    const duplicates: Array<{ habitKey: string; records: HabitRegistryRecord[] }> = [];
    const map = this.registry.getDuplicates();
    for (const [habitKey, records] of map.entries()) {
      const scoped = records.filter((record) => (record.group ?? "").trim().toLowerCase() === normalizedGroup);
      if (scoped.length > 1) {
        duplicates.push({ habitKey, records: scoped });
      }
    }
    return duplicates;
  }

  private renderGroupSummary(container: HTMLElement, active: number, total: number): void {
    const summary = container.createDiv({ cls: "dv-habit-group-summary" });
    summary.textContent = `${active}/${total}`;
    container.createDiv({ cls: "dv-habit-group-caption", text: t("group.summaryCaption") });
  }

  private renderGroupDuplicates(
    container: HTMLElement,
    duplicates: Array<{ habitKey: string; records: HabitRegistryRecord[] }>,
    sourcePath: string,
  ): void {
    const warning = container.createDiv({ cls: "dv-habit-group-duplicates" });
    warning.createDiv({ text: t("group.duplicatesHeading") });
    const list = warning.createEl("ul");
    for (const duplicate of duplicates) {
      const item = list.createEl("li");
      const displayName = duplicate.records[0]?.options.normalizedTitle ?? duplicate.habitKey;
      item.createSpan({ text: `${displayName}: ` });
      duplicate.records.forEach((record, index) => {
        const link = item.createEl("a", {
          cls: "dv-habit-group-link",
          text: record.sourcePath,
          attr: { href: "#" },
        });
        link.addEventListener("click", (event) => {
          event.preventDefault();
          this.openPath(record.sourcePath, sourcePath);
        });
        if (index < duplicate.records.length - 1) {
          item.appendChild(document.createTextNode(", "));
        }
      });
    }
  }

  private openPath(target: string, from: string): void {
    const openLinkText = (this.app.workspace as any)?.openLinkText;
    if (typeof openLinkText === "function") {
      openLinkText(target, from, false);
    }
  }

  private renderHeatRow(state: {
    options: ResolvedHabitOptions;
    stats: HabitStats;
    heat: HTMLElement;
  }): void {
    const { options, stats, heat } = state;
    heat.className = "dv-habit-heat-row";
    heat.empty();

    const start = today0();
    start.setDate(start.getDate() - (options.days - 1));

    for (let i = 0; i < options.days; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const iso = isoOf(current.getFullYear(), current.getMonth() + 1, current.getDate());
      const count = stats.countsByISO.get(iso) ?? 0;
      const level = Math.max(0, Math.min(4, count));
      const dot = heat.createDiv({
        cls: `dv-habit-dot ${level ? `dot-l${Math.min(level, 4)}` : ""}`.trim(),
      });
      dot.title = `${iso}: ${count || 0}`;
    }

    requestAnimationFrame(() => {
      heat.scrollLeft = heat.scrollWidth;
    });
  }

  private renderHeatGrid(state: {
    options: ResolvedHabitOptions;
    stats: HabitStats;
    heat: HTMLElement;
  }): void {
    const { options, stats, heat } = state;
    heat.className = "dv-habit-heat-grid";
    heat.empty();

    const today = today0();
    const weekStart = this.settings.weekStart ?? DEFAULT_SETTINGS.weekStart;
    const isoDow = weekStart === "sunday" ? today.getDay() : (today.getDay() + 6) % 7; // Mon=0..Sun=6
    const start = new Date(today);
    start.setDate(today.getDate() - isoDow - (options.weeks - 1) * 7);

    for (let w = 0; w < options.weeks; w++) {
      const column = heat.createDiv({ cls: "dv-habit-col" });
      for (let i = 0; i < 7; i++) {
        const current = new Date(start);
        current.setDate(start.getDate() + w * 7 + i);
        const y = current.getFullYear();
        const mo = current.getMonth() + 1;
        const d = current.getDate();
        const iso = isoOf(y, mo, d);
        const count = stats.countsByISO.get(iso) ?? 0;
        const level = Math.max(0, Math.min(4, count));
        const isFuture = current > today;
        const cell = column.createDiv({
          cls: `dv-habit-cell ${isFuture ? "is-future" : ""} ${
            level ? `dot-l${Math.min(level, 4)}` : ""
          }`.trim(),
        });
        cell.title = `${iso}: ${count || 0}`;
      }
    }

    requestAnimationFrame(() => {
      heat.scrollLeft = heat.scrollWidth;
    });
  }

  private async logHabitEntry(options: ResolvedHabitOptions): Promise<Date | null> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = pad2(now.getMonth() + 1);
    const dd = pad2(now.getDate());
    const fileName = `${yyyy}-${mm}-${dd}.md`;
    const folder = trimSlashes(options.dailyFolder);
    const path = folder ? `${folder}/${fileName}` : fileName;

    const habitLine = `\n- ${options.habitTag} ${nowHHMM(now)}\n`;
    let file = this.app.vault.getAbstractFileByPath(path) as TFile | null;

    if (!file) {
      let templateContent = "";
      if (options.templatePath) {
        const templateFile = this.app.vault.getAbstractFileByPath(options.templatePath);
        if (templateFile instanceof TFile) {
          try {
            templateContent = await this.app.vault.read(templateFile);
          } catch (error) {
            console.warn("Habit Button: unable to read template", error);
          }
        } else {
          console.warn("Habit Button: unable to read template", options.templatePath);
        }
      }

      if (templateContent) {
        templateContent = ensureTrailingNewline(templateContent);
      }

      await this.app.vault.create(path, `${templateContent}${habitLine}`);
      file = this.app.vault.getAbstractFileByPath(path) as TFile | null;
    } else {
      await this.app.vault.append(file, habitLine);
    }

    this.markPathStale(path);

    new Notice(t("ui.noticeAdded", options.normalizedTitle));
    return now;
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class DisposableRenderChild extends MarkdownRenderChild {
  private dispose: () => void;

  constructor(containerEl: HTMLElement, dispose: () => void) {
    super(containerEl);
    this.dispose = dispose;
  }

  onunload(): void {
    this.dispose();
  }
}
