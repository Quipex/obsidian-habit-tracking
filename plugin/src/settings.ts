import { App, PluginSettingTab, Setting } from "obsidian";
import HabitButtonPlugin from "./main";

export interface HabitButtonSettings {
  dailyFolder: string;
  defaultLayout: "grid" | "row";
  weeks: number;
  days: number;
  templatePath: string;
}

export const DEFAULT_SETTINGS: HabitButtonSettings = {
  dailyFolder: "daily",
  defaultLayout: "grid",
  weeks: 26,
  days: 240,
  templatePath: "meta/templates/daily note template.md",
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
    containerEl.createEl("h2", { text: "Habit Button" });

    new Setting(containerEl)
      .setName("Daily folder")
      .setDesc("Folder that contains daily notes to scan for habits.")
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
      .setName("Daily note template")
      .setDesc("Optional template used when creating a missing daily note.")
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
      .setName("Default layout")
      .setDesc("Heatmap layout to use when none is specified in the block.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ grid: "Grid", row: "Row" })
          .setValue(this.plugin.settings.defaultLayout)
          .onChange(async (value) => {
            if (value === "grid" || value === "row") {
              this.plugin.settings.defaultLayout = value;
              await this.plugin.saveSettings();
            }
          }),
      );

    new Setting(containerEl)
      .setName("Grid weeks")
      .setDesc("Number of weeks to show in grid heatmap layout.")
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
      .setName("Row days")
      .setDesc("Number of days to show in row heatmap layout.")
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
