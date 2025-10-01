import { Editor, MarkdownPostProcessorContext, Notice, Plugin, TFile } from "obsidian";
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
} from "./habit-core";
import type { HabitStats, ResolvedHabitOptions } from "./habit-core";

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

export default class HabitButtonPlugin extends Plugin {
  settings: HabitButtonSettings = DEFAULT_SETTINGS;
  private styleEl: HTMLStyleElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.refreshLocale();

    this.registerMarkdownCodeBlockProcessor(
      "habit-button",
      (source, el, ctx) => this.renderHabitButton(source, el, ctx),
    );

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

  private renderHabitButton(
    source: string,
    el: HTMLElement,
    _ctx: MarkdownPostProcessorContext,
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

    void this.mountHabitButton(el, options);
  }

  private async mountHabitButton(el: HTMLElement, options: ResolvedHabitOptions): Promise<void> {
    const stats = await collectHabitStats(options, {
      vault: this.app.vault,
      tagPrefix: options.tagPrefix,
      defaultGracePeriodHours: clampPositive(
        this.settings.defaultGracePeriodHours,
        DEFAULT_SETTINGS.defaultGracePeriodHours,
      ),
      defaultWarningWindowHours: clampPositive(
        this.settings.defaultWarningWindowHours,
        DEFAULT_SETTINGS.defaultWarningWindowHours,
        0,
      ),
    });

    el.empty();
    const card = el.createDiv({ cls: "dv-habit-card" });
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

        refresh();
      } catch (error) {
        console.error("[habit-button] append error", error);
        new Notice(t("ui.noticeError"), 4000);
      }
    });
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
