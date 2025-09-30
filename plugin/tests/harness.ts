import { vi } from "vitest";
import {
  Command,
  MarkdownPostProcessor,
  MarkdownPostProcessorContext,
  PluginManifest,
  TFile,
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

  async read(file: { path: string }) {
    return this.cachedRead(file);
  }

  async create(path: string, content: string) {
    this.files.set(path, content);
  }

  async append(file: { path: string }, content: string) {
    this.files.set(file.path, (this.files.get(file.path) ?? "") + content);
  }

  getAbstractFileByPath(path: string) {
    if (!this.files.has(path)) return null;
    const file = new TFile();
    file.path = path;
    file.basename = path.replace(/^.*\//, "").replace(/\.md$/, "");
    return file;
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

type CodeBlockHandler = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<any>;

export class PluginHarness extends HabitButtonPlugin {
  public commands: Command[] = [];
  public processors: Array<{ language: string; processor: CodeBlockHandler }> = [];
  public settingTabs: any[] = [];
  public cleanups: Array<() => void> = [];
  public savedSettings?: HabitButtonSettings;
  private initialSettings?: Partial<HabitButtonSettings> | null;

  constructor(initialSettings?: Partial<HabitButtonSettings> | null) {
    super(new FakeApp() as any, manifest);
    this.initialSettings = initialSettings ?? null;
  }

  get fakeApp(): FakeApp {
    return (this as unknown as { app: FakeApp }).app;
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

  override registerMarkdownCodeBlockProcessor(language: string, processor: CodeBlockHandler, sortOrder?: number) {
    this.processors.push({ language, processor });
    return Object.assign(
      ((el: HTMLElement, ctx: MarkdownPostProcessorContext) => processor("", el, ctx)) as unknown as MarkdownPostProcessor,
      { sortOrder },
    );
  }

  override register(onunload: () => void): void {
    this.cleanups.push(onunload);
  }

  override async loadData(): Promise<Partial<HabitButtonSettings> | null> {
    return this.initialSettings ?? null;
  }

  override async saveData(data: HabitButtonSettings): Promise<void> {
    this.savedSettings = data;
  }
}

export async function bootstrapPlugin(settings?: Partial<HabitButtonSettings>): Promise<PluginHarness> {
  const plugin = new PluginHarness(settings ?? null);
  await plugin.onload();
  return plugin;
}

export function getCodeBlockProcessor(plugin: PluginHarness, language = "habit-button"): CodeBlockHandler {
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
export function getTodayPath(folder: string): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const fileName = `${yyyy}-${mm}-${dd}.md`;
  return folder ? `${folder}/${fileName}` : fileName;
}
export async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await vi.runAllTimersAsync();
}
