import { parse as parseYamlLib } from "yaml";
export type MarkdownPostProcessor = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void | Promise<any>;

export interface MarkdownPostProcessorContext {}


export class App {
  vault: any;
  workspace: any;
}

export interface Command {
  id: string;
  name: string;
  editorCallback?: (editor: Editor) => void;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  dir: string;
  author: string;
  authorUrl: string;
  version: string;
  minAppVersion: string;
  isDesktopOnly: boolean;
}

export class Plugin {
  app: any;
  manifest: PluginManifest;

  constructor(app: any, manifest: PluginManifest) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand(_command: any): any {}
  addSettingTab(_tab: any): void {}
  registerMarkdownCodeBlockProcessor(_language: string, processor: MarkdownPostProcessor): MarkdownPostProcessor {
    return processor;
  }
  register(_onunload: () => void): void {}
  async loadData(): Promise<any> { return null; }
  async saveData(_data: any): Promise<void> {}
}

export class PluginSettingTab {
  app: any;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: any, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }

  display(): void {}
}

export class Setting {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  addText(cb: (text: any) => void): this { cb({}); return this; }
  addDropdown(cb: (dropdown: any) => void): this { cb({}); return this; }
  addSlider(cb: (slider: any) => void): this { cb({}); return this; }
}

export function setIcon(_el: HTMLElement, _icon: string): void {}

export class Notice {
  message: string;
  timeout?: number;

  constructor(message: string, timeout?: number) {
    this.message = message;
    this.timeout = timeout;
  }
}

export class TFile {
  path = "";
  basename = "";
}

export interface Editor {
  getCursor(): any;
  replaceRange(text: string, cursor: any): void;
}

export function parseYaml(value: string): any {
  return parseYamlLib(value) ?? {};
}
