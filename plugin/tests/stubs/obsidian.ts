import { parse as parseYamlLib } from "yaml";
export type MarkdownPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void;

export interface MarkdownPostProcessorContext {}

export class Plugin {
  app: any;
  manifest: any;

  constructor(app: any, manifest: any = {}) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand(_command: any): any {}
  addSettingTab(_tab: any): void {}
  registerMarkdownCodeBlockProcessor(_language: string, _processor: MarkdownPostProcessor): void {}
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
  addText(_cb: any): this { return this; }
  addDropdown(_cb: any): this { return this; }
  addSlider(_cb: any): this { return this; }
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

export class TFile {}

export interface Editor {}

export function parseYaml(value: string): any {
  return parseYamlLib(value) ?? {};
}
