import {
  Editor,
  MarkdownPostProcessorContext,
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
import styles from "../styles.css";

type HeatLayout = "grid" | "row";

interface HabitBlockOptions {
  title?: string;
  warnHoursThreshold?: number;
  icon?: string;
  dailyFolder?: string;
  heatLayout?: HeatLayout;
  weeks?: number;
  days?: number;
  cellSize?: number;
  cellGap?: number;
  dotSize?: number;
  dotGap?: number;
  templatePath?: string;
}

interface ResolvedHabitOptions {
  title: string;
  normalizedTitle: string;
  warnHoursThreshold?: number;
  icon?: string;
  dailyFolder: string;
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
}

interface HabitStats {
  countsByISO: Map<string, number>;
  hasByISO: Set<string>;
  lastTsByISO: Map<string, Date>;
  lastTs: Date | null;
  streak: number;
  allowedGapH: number;
  allowedGapMs: number;
}

interface HabitDayParts {
  y: number;
  mo: number;
  d: number;
}

const DEFAULT_DIMENSIONS = {
  cellSize: 9,
  cellGap: 3,
  dotSize: 8,
  dotGap: 4,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toHabitKey(value: string): string {
  const lower = value.toLowerCase();
  return lower
    .replace(/\s+/g, "_")
    .replace(/[^a-zа-яё0-9_]/gi, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function nowHHMM(now: Date): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function parseYMD(name: string): HabitDayParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(name);
  if (!match) return null;
  return { y: Number(match[1]), mo: Number(match[2]), d: Number(match[3]) };
}

function makeLocalDate(y: number, mo: number, d: number, hh = 0, mm = 0): Date {
  return new Date(y, mo - 1, d, hh, mm, 0, 0);
}

function isoOf(y: number, mo: number, d: number): string {
  return `${y}-${pad2(mo)}-${pad2(d)}`;
}

function today0(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function humanAgoShort(ts: Date | null): string {
  if (!ts) return "—";
  const diffMs = Date.now() - ts.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;

  if (days === 0 && hours < 1) {
    return mins < 2 ? "только что" : `${minutes}м назад`;
  }
  if (days === 0) {
    return `${hours}ч назад`;
  }
  if (days < 2) {
    return `${days * 24 + hours}ч. назад`;
  }
  return `${days} дн. назад`;
}

function computeStreakByDays(days: Date[], allowedGapMs: number): number {
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

function sortDatesAscending(list: Iterable<Date>): Date[] {
  return Array.from(list).sort((a, b) => a.getTime() - b.getTime());
}

function ensureTrailingNewline(value: string): string {
  if (!value.endsWith("\n")) return `${value}\n`;
  return value;
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

export default class HabitButtonPlugin extends Plugin {
  settings: HabitButtonSettings = DEFAULT_SETTINGS;
  private styleEl: HTMLStyleElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerMarkdownCodeBlockProcessor(
      "habit-button",
      (source, el, ctx) => this.renderHabitButton(source, el, ctx),
    );

    this.addCommand({
      id: "habit-button-insert-block",
      name: "Insert habit button block",
      editorCallback: (editor: Editor) => {
        const cursor = editor.getCursor();
        const snippet =
          "```habit-button\n" +
          "title: Моя привычка\n" +
          "heatLayout: grid\n" +
          "```\n";
        editor.replaceRange(snippet, cursor);
      },
    });

    this.addSettingTab(new HabitButtonSettingTab(this.app, this));

    this.injectStyles();
  }

  onunload(): void {
    this.disposeStyles();
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

  private parseBlock(source: string): HabitBlockOptions {
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

  private resolveOptions(raw: HabitBlockOptions): ResolvedHabitOptions | null {
    const title = raw.title ? normalizeWhitespace(String(raw.title)) : "";
    if (!title) return null;

    const normalizedTitle = capitalizeFirst(title);
    const layout = raw.heatLayout === "row" ? "row" : raw.heatLayout === "grid" ? "grid" : this.settings.defaultLayout;

    const weeks = Number.isFinite(raw.weeks) ? Math.max(1, Number(raw.weeks)) : this.settings.weeks;
    const days = Number.isFinite(raw.days) ? Math.max(1, Number(raw.days)) : this.settings.days;

    const dailyFolder = raw.dailyFolder?.trim().length
      ? trimSlashes(raw.dailyFolder.trim())
      : this.settings.dailyFolder;

    const templateCandidate = raw.templatePath?.trim() || this.settings.templatePath?.trim();
    const templatePath = templateCandidate ? templateCandidate : undefined;

    return {
      title,
      normalizedTitle,
      icon: raw.icon,
      warnHoursThreshold: typeof raw.warnHoursThreshold === "number" ? raw.warnHoursThreshold : undefined,
      dailyFolder,
      heatLayout: layout,
      weeks,
      days,
      cellSize: Number.isFinite(raw.cellSize) ? Number(raw.cellSize) : DEFAULT_DIMENSIONS.cellSize,
      cellGap: Number.isFinite(raw.cellGap) ? Number(raw.cellGap) : DEFAULT_DIMENSIONS.cellGap,
      dotSize: Number.isFinite(raw.dotSize) ? Number(raw.dotSize) : DEFAULT_DIMENSIONS.dotSize,
      dotGap: Number.isFinite(raw.dotGap) ? Number(raw.dotGap) : DEFAULT_DIMENSIONS.dotGap,
      templatePath,
      habitKey: toHabitKey(title),
      habitTag: `#habit_${toHabitKey(title)}`,
    };
  }

  private async collectHabitStats(options: ResolvedHabitOptions): Promise<HabitStats> {
    const countsByISO = new Map<string, number>();
    const hasByISO = new Set<string>();
    const lastTsByISO = new Map<string, Date>();

    const folder = trimSlashes(options.dailyFolder);
    const folderPrefix = folder ? `${folder}/` : "";

    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => (folder ? file.path.startsWith(folderPrefix) : true));

    const habitRegex = new RegExp(`${escapeRegExp("#habit_")}([^\\s#]+)(?:\\s+(\\d{1,2}:\\d{2}))?`, "gim");
    const needle = options.habitKey.toLowerCase();

    for (const file of files) {
      const day = parseYMD(file.basename);
      if (!day) continue;

      const content = await this.app.vault.cachedRead(file);
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

    const allowedGapH = Number.isFinite(options.warnHoursThreshold)
      ? Math.max(1, Number(options.warnHoursThreshold)) + 24
      : 48;
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
    };
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

  private renderHabitButton(
    source: string,
    el: HTMLElement,
    _ctx: MarkdownPostProcessorContext,
  ): void {
    const blockOptions = this.parseBlock(source);
    const options = this.resolveOptions(blockOptions);

    if (!options) {
      this.renderError(el, "[habit-button] Не задан title");
      return;
    }

    void this.mountHabitButton(el, options);
  }

  private async mountHabitButton(el: HTMLElement, options: ResolvedHabitOptions): Promise<void> {
    const stats = await this.collectHabitStats(options);

    el.empty();
    const card = el.createDiv({ cls: "dv-habitv2-card" });
    const iconBtn = card.createEl("button", {
      cls: "dv-habitv2-iconbtn",
      text: options.icon || "✅",
      attr: { title: `Отметить: ${options.normalizedTitle}` },
    });

    const right = card.createDiv({ cls: "dv-habitv2-right" });
    const titleRow = right.createDiv();
    titleRow.createDiv({ cls: "dv-habitv2-title", text: options.normalizedTitle });

    const heat = right.createDiv({ cls: "dv-habitv2-heat-row" });
    const meta = right.createDiv({ cls: "dv-habitv2-meta" });
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
      const shouldWarn =
        typeof options.warnHoursThreshold === "number" &&
        Number.isFinite(options.warnHoursThreshold) &&
        hoursSinceLast >= options.warnHoursThreshold &&
        !isStreakAlive;
      lastElement.classList.toggle("is-overdue", shouldWarn);

      const streakPrefix = `Стрик: ${currentStats.streak} дн.`;
      streakElement.textContent = streakPrefix;
      streakElement.classList.toggle("is-zero", currentStats.streak === 0);

      const remH = Number.isFinite(hoursSinceLast)
        ? currentStats.allowedGapH - hoursSinceLast
        : -Infinity;
      if (currentStats.streak > 0 && remH > 0 && remH <= 24) {
        const hint = streakElement.createSpan({ cls: "time-left" });
        const hrs = Math.ceil(remH);
        hint.textContent = ` <${hrs}ч. 🔥`;
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

        refresh();
      } catch (error) {
        console.error("[habit-button] append error", error);
        new Notice("Ошибка при записи привычки", 4000);
      }
    });
  }

  private renderHeatRow(state: {
    options: ResolvedHabitOptions;
    stats: HabitStats;
    heat: HTMLElement;
  }): void {
    const { options, stats, heat } = state;
    heat.className = "dv-habitv2-heat-row";
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
        cls: `dv-habitv2-dot ${level ? `dot-l${Math.min(level, 4)}` : ""}`.trim(),
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
    heat.className = "dv-habitv2-heat-grid";
    heat.empty();

    const today = today0();
    const isoDow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
    const start = new Date(today);
    start.setDate(today.getDate() - isoDow - (options.weeks - 1) * 7);

    for (let w = 0; w < options.weeks; w++) {
      const column = heat.createDiv({ cls: "dv-habitv2-col" });
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
          cls: `dv-habitv2-cell ${isFuture ? "is-future" : ""} ${
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

    new Notice(`Добавлено: ${options.normalizedTitle}`);
    return now;
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
