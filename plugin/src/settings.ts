import { App, PluginSettingTab, Setting } from "obsidian";
import HabitButtonPlugin from "./main";
import { t } from "./i18n";
import type { LocalePreference } from "./i18n";

export interface HabitButtonSettings {
  dailyFolder: string;
  defaultLayout: "grid" | "row";
  weeks: number;
  days: number;
  templatePath: string;
  locale: LocalePreference;
}

export const DEFAULT_SETTINGS: HabitButtonSettings = {
  dailyFolder: "daily",
  defaultLayout: "grid",
  weeks: 26,
  days: 240,
  templatePath: "meta/templates/daily note template.md",
  locale: "auto",
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
              this.plugin.settings.locale = value;
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
          .onChange(async (value) => {
            this.plugin.settings.dailyFolder = value.trim() || "daily";
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
          .onChange(async (value) => {
            this.plugin.settings.templatePath = value.trim();
            await this.plugin.saveSettings();
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

    new Setting(containerEl)
      .setName(t("settings.gridWeeks.label"))
      .setDesc(t("settings.gridWeeks.desc"))
      .addSlider((slider) =>
        slider
          .setLimits(4, 52, 1)
          .setValue(this.plugin.settings.weeks)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.weeks = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.rowDays.label"))
      .setDesc(t("settings.rowDays.desc"))
      .addSlider((slider) =>
        slider
          .setLimits(30, 365, 5)
          .setValue(this.plugin.settings.days)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.days = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
