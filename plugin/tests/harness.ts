import type {
  Command,
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
  PluginManifest,
} from "obsidian";
import HabitButtonPlugin from "../src/main";
import type { HabitButtonSettings } from "../src/settings";

class FakeVault {
  files: Map<string, string> = new Map();

  getMarkdownFiles() {
    return Array.from(this.files.keys()).map((path) => ({
      path,
      basename: path.replace(/^.*\//, "").replace(/\.md$/, ""),
    }));
  }

  async cachedRead(file: { path: string }) {
    return this.files.get(file.path) ?? "";
  }

  async create(path: string, content: string) {
    this.files.set(path, content);
  }

  async append(file: { path: string }, content: string) {
    this.files.set(file.path, (this.files.get(file.path) ?? "") + content);
  }

  getAbstractFileByPath(path: string) {
    if (!this.files.has(path)) return null;
    return { path };
  }
}

class FakeApp {
  vault = new FakeVault();
  workspace = {};
}

const manifest: PluginManifest = {
  id: "habit-button",
  name: "Habit Button",
  description: "",
  dir: "",
  author: "",
  authorUrl: "",
  version: "0.0.0",
  minAppVersion: "1.0.0",
  isDesktopOnly: false,
};

export class PluginHarness extends HabitButtonPlugin {
  public commands: Command[] = [];
  public processors: Array<{ language: string; processor: MarkdownPostProcessor }> = [];
  public settingTabs: any[] = [];
  public cleanups: Array<() => void> = [];
  public savedSettings?: HabitButtonSettings;

  constructor() {
    super(new FakeApp() as any, manifest);
  }

  get fakeApp(): FakeApp {
    return super.app as FakeApp;
  }

  get vault() {
    return this.fakeApp.vault;
  }

  override addCommand(command: Command) {
    this.commands.push(command);
    return command;
  }

  override addSettingTab(tab: any) {
    this.settingTabs.push(tab);
  }

  override registerMarkdownCodeBlockProcessor(language: string, processor: MarkdownPostProcessor) {
    this.processors.push({ language, processor });
  }

  override register(onunload: () => void): void {
    this.cleanups.push(onunload);
  }

  override async loadData(): Promise<Partial<HabitButtonSettings> | null> {
    return null;
  }

  override async saveData(data: HabitButtonSettings): Promise<void> {
    this.savedSettings = data;
  }
}

export async function bootstrapPlugin(): Promise<PluginHarness> {
  const plugin = new PluginHarness();
  await plugin.onload();
  return plugin;
}

export function getCodeBlockProcessor(plugin: PluginHarness, language = "habit-button") {
  const entry = plugin.processors.find((processor) => processor.language === language);
  if (!entry) throw new Error(`Processor for ${language} not registered`);
  return entry.processor;
}

export async function renderHabitBlock(
  plugin: PluginHarness,
  source: string,
  ctx: Partial<MarkdownPostProcessorContext> = {},
): Promise<HTMLElement> {
  const processor = getCodeBlockProcessor(plugin);
  const container = document.createElement("div");
  await processor(source, container, ctx as MarkdownPostProcessorContext);
  return container;
}
