import { App, PluginSettingTab, Setting, SliderComponent, TextComponent } from "obsidian";
import HabitButtonPlugin from "./main";
import { t } from "./i18n";
import type { LocalePreference } from "./i18n";

export const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";

export interface HabitButtonSettings {
  dailyFolder: string;
  dailyNoteFormat: string;
  defaultLayout: "grid" | "row";
  weeks: number;
  days: number;
  templatePath: string;
  locale: LocalePreference;
  defaultCellSize: number;
  defaultCellGap: number;
  defaultDotSize: number;
  defaultDotGap: number;
  tagPrefix: string;
  defaultGracePeriodHours: number;
  defaultWarningWindowHours: number;
  weekStart: "monday" | "sunday";
  defaultBorder: boolean;
}

export const DEFAULT_SETTINGS: HabitButtonSettings = {
  dailyFolder: "daily",
  dailyNoteFormat: DEFAULT_DAILY_NOTE_FORMAT,
  defaultLayout: "grid",
  weeks: 26,
  days: 30,
  templatePath: "meta/templates/daily note template.md",
  locale: "auto",
  defaultCellSize: 9,
  defaultCellGap: 3,
  defaultDotSize: 8,
  defaultDotGap: 4,
  tagPrefix: "habit",
  defaultGracePeriodHours: 24,
  defaultWarningWindowHours: 24,
  weekStart: "monday",
  defaultBorder: true,
};

export class HabitButtonSettingTab extends PluginSettingTab {
  plugin: HabitButtonPlugin;

  constructor(app: App, plugin: HabitButtonPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: t("settings.heading") });

    const addSliderWithNumber = (
      setting: Setting,
      options: {
        min: number;
        max?: number;
        step?: number;
        value: number;
        onChange: (value: number) => Promise<void> | void;
        tooltip?: boolean;
      },
    ): void => {
      const { min, max = Number.MAX_SAFE_INTEGER, step = 1, value, onChange, tooltip = true } = options;
      const snapToStep = (input: number): number => {
        const stepped = Math.round((input - min) / step) * step + min;
        return Math.min(max, Math.max(min, stepped));
      };

      let sliderRef: SliderComponent;
      let textRef: TextComponent;
      let syncing = false;
      let lastValue = snapToStep(value);

      const applyValue = async (
        candidate: number,
        origin: "slider" | "text" | "blur",
      ): Promise<void> => {
        const snapped = snapToStep(candidate);
        const changed = snapped !== lastValue;
        syncing = true;
        try {
          if (origin !== "slider") sliderRef.setValue(snapped);
          if (origin !== "text") textRef.setValue(String(snapped));
          if (changed) {
            lastValue = snapped;
            await onChange(snapped);
          } else {
            lastValue = snapped;
          }
        } finally {
          syncing = false;
        }
      };

      setting.addSlider((slider) => {
        sliderRef = slider
          .setLimits(min, max, step)
          .setValue(lastValue);

        if (tooltip) slider.setDynamicTooltip();

        slider.onChange(async (newValue: number) => {
          if (syncing) return;
          await applyValue(newValue, "slider");
        });
      });

      setting.addText((text) => {
        textRef = text;
        const inputEl = text.inputEl;
        inputEl.type = "number";
        inputEl.step = String(step);
        inputEl.min = String(min);
        inputEl.max = String(max);
        text.setValue(String(lastValue));

        text.onChange(async (raw) => {
          if (syncing) return;
          const trimmed = raw.trim();
          if (trimmed === "") return;
          const parsed = Number(trimmed);
          if (!Number.isFinite(parsed)) return;
          if (parsed < min || parsed > max) return;
          await applyValue(parsed, "text");
        });

        inputEl.addEventListener("blur", async () => {
          if (syncing) return;
          const raw = text.getValue().trim();
          if (raw === "") {
            await applyValue(lastValue, "blur");
            return;
          }
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) {
            await applyValue(lastValue, "blur");
            return;
          }
          await applyValue(parsed, "blur");
        });
      });
    };

    new Setting(containerEl)
      .setName(t("settings.language.label"))
      .setDesc(t("settings.language.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            auto: t("settings.language.options.auto"),
            en: t("settings.language.options.en"),
            ru: t("settings.language.options.ru"),
          })
          .setValue(this.plugin.settings.locale)
          .onChange(async (value) => {
            if (value === "auto" || value === "en" || value === "ru") {
              this.plugin.settings.locale = value as LocalePreference;
              await this.plugin.saveSettings();
              this.plugin.refreshLocale();
              this.display();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.dailyFolder.label"))
      .setDesc(t("settings.dailyFolder.desc"))
      .addText((text) =>
        text
          .setPlaceholder("daily")
          .setValue(this.plugin.settings.dailyFolder)
          .onChange(async (value: string) => {
            this.plugin.settings.dailyFolder = value.trim() || "daily";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.dailyNoteFormat.label"))
      .setDesc(t("settings.dailyNoteFormat.desc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_DAILY_NOTE_FORMAT)
          .setValue(this.plugin.settings.dailyNoteFormat || DEFAULT_DAILY_NOTE_FORMAT)
          .onChange(async (value: string) => {
            this.plugin.settings.dailyNoteFormat = value.trim() || DEFAULT_DAILY_NOTE_FORMAT;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.templatePath.label"))
      .setDesc(t("settings.templatePath.desc"))
      .addText((text) =>
        text
          .setPlaceholder("meta/templates/daily note template.md")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async (value: string) => {
            this.plugin.settings.templatePath = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.border.label"))
      .setDesc(t("settings.border.desc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.defaultBorder)
          .onChange(async (value) => {
            this.plugin.settings.defaultBorder = value;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: t("settings.dimensions.heading") });

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.dimensions.cellSize.label"))
        .setDesc(t("settings.dimensions.cellSize.desc")),
      {
        min: 1,
        max: 100,
        value: this.plugin.settings.defaultCellSize,
        onChange: async (value) => {
          this.plugin.settings.defaultCellSize = value;
          await this.plugin.saveSettings();
        },
      },
    );

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.dimensions.cellGap.label"))
        .setDesc(t("settings.dimensions.cellGap.desc")),
      {
        min: 0,
        max: 20,
        value: this.plugin.settings.defaultCellGap,
        onChange: async (value) => {
          this.plugin.settings.defaultCellGap = value;
          await this.plugin.saveSettings();
        },
      },
    );

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.dimensions.dotSize.label"))
        .setDesc(t("settings.dimensions.dotSize.desc")),
      {
        min: 1,
        max: 100,
        value: this.plugin.settings.defaultDotSize,
        onChange: async (value) => {
          this.plugin.settings.defaultDotSize = value;
          await this.plugin.saveSettings();
        },
      },
    );

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.dimensions.dotGap.label"))
        .setDesc(t("settings.dimensions.dotGap.desc")),
      {
        min: 0,
        max: 20,
        value: this.plugin.settings.defaultDotGap,
        onChange: async (value) => {
          this.plugin.settings.defaultDotGap = value;
          await this.plugin.saveSettings();
        },
      },
    );

    containerEl.createEl("h3", { text: t("settings.habits.heading") });

    new Setting(containerEl)
      .setName(t("settings.tagPrefix.label"))
      .setDesc(t("settings.tagPrefix.desc"))
      .addText((text) =>
        text
          .setPlaceholder("habit")
          .setValue(this.plugin.settings.tagPrefix)
          .onChange(async (value: string) => {
            const normalized = value.trim() || "habit";
            this.plugin.settings.tagPrefix = normalized;
            await this.plugin.saveSettings();
          }),
      );

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.gracePeriod.label"))
        .setDesc(t("settings.gracePeriod.desc")),
      {
        min: 0,
        value: this.plugin.settings.defaultGracePeriodHours,
        onChange: async (value) => {
          this.plugin.settings.defaultGracePeriodHours = value;
          await this.plugin.saveSettings();
        },
      },
    );

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.warnWindow.label"))
        .setDesc(t("settings.warnWindow.desc")),
      {
        min: 0,
        value: this.plugin.settings.defaultWarningWindowHours,
        onChange: async (value) => {
          this.plugin.settings.defaultWarningWindowHours = value;
          await this.plugin.saveSettings();
        },
      },
    );

    new Setting(containerEl)
      .setName(t("settings.weekStart.label"))
      .setDesc(t("settings.weekStart.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            monday: t("settings.weekStart.options.monday"),
            sunday: t("settings.weekStart.options.sunday"),
          })
          .setValue(this.plugin.settings.weekStart)
          .onChange(async (value) => {
            if (value === "monday" || value === "sunday") {
              this.plugin.settings.weekStart = value;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.defaultLayout.label"))
      .setDesc(t("settings.defaultLayout.desc"))
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ grid: t("settings.defaultLayout.options.grid"), row: t("settings.defaultLayout.options.row") })
          .setValue(this.plugin.settings.defaultLayout)
          .onChange(async (value) => {
            if (value === "grid" || value === "row") {
              this.plugin.settings.defaultLayout = value;
              await this.plugin.saveSettings();
            }
          }),
      );

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.gridWeeks.label"))
        .setDesc(t("settings.gridWeeks.desc")),
      {
        min: 1,
        value: this.plugin.settings.weeks,
        onChange: async (value) => {
          this.plugin.settings.weeks = value;
          await this.plugin.saveSettings();
        },
      },
    );

    addSliderWithNumber(
      new Setting(containerEl)
        .setName(t("settings.rowDays.label"))
        .setDesc(t("settings.rowDays.desc")),
      {
        min: 1,
        value: this.plugin.settings.days,
        onChange: async (value) => {
          this.plugin.settings.days = value;
          await this.plugin.saveSettings();
        },
      },
    );
  }
}
