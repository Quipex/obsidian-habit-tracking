import { parse as parseYamlLib } from "yaml";

export type MarkdownPostProcessor = (
  source: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
) => void | Promise<any>;

export class MarkdownRenderChild {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  onload(): void {}

  onunload(): void {}
}

export interface MarkdownPostProcessorContext {
  sourcePath?: string;
  addChild?(child: MarkdownRenderChild): void;
}

export class App {
  vault: any;
  workspace: any;
  locale?: string;
  constructor() {
    this.vault = {
      getConfig: (_key: string) => undefined,
    };
    this.workspace = {};
    this.locale = "en";
  }
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

type ChangeHandler<T> = (value: T) => void | Promise<void>;

export class SliderComponent {
  inputEl: HTMLInputElement;
  private min = 0;
  private max = 100;
  private step = 1;
  private value = 0;
  private onChangeHandlers: ChangeHandler<number>[] = [];

  constructor(container?: HTMLElement) {
    this.inputEl = document.createElement("input");
    this.inputEl.type = "range";
    if (container) container.appendChild(this.inputEl);
  }

  setLimits(min: number, max: number, step: number): this {
    this.min = min;
    this.max = max;
    this.step = step;
    this.inputEl.min = String(min);
    this.inputEl.max = String(max);
    this.inputEl.step = String(step);
    return this;
  }

  setValue(value: number): this {
    this.value = value;
    this.inputEl.value = String(value);
    return this;
  }

  getValue(): number {
    return this.value;
  }

  onChange(handler: ChangeHandler<number>): this {
    this.onChangeHandlers.push(handler);
    return this;
  }

  setDynamicTooltip(): this {
    return this;
  }

  async triggerChange(value: number): Promise<void> {
    this.setValue(value);
    for (const handler of this.onChangeHandlers) {
      await handler(value);
    }
  }
}

export class TextComponent {
  inputEl: HTMLInputElement;
  private value = "";
  private onChangeHandlers: ChangeHandler<string>[] = [];

  constructor(container?: HTMLElement) {
    this.inputEl = document.createElement("input");
    if (container) container.appendChild(this.inputEl);
  }

  setPlaceholder(value: string): this {
    this.inputEl.placeholder = value;
    return this;
  }

  setValue(value: string): this {
    this.value = value;
    this.inputEl.value = value;
    return this;
  }

  getValue(): string {
    return this.inputEl.value ?? this.value;
  }

  onChange(handler: ChangeHandler<string>): this {
    this.onChangeHandlers.push(handler);
    return this;
  }

  async triggerChange(value: string): Promise<void> {
    this.setValue(value);
    for (const handler of this.onChangeHandlers) {
      await handler(value);
    }
  }
}

export class DropdownComponent {
  selectEl: HTMLSelectElement;
  private options: Record<string, string> = {};
  private value = "";
  private onChangeHandlers: ChangeHandler<string>[] = [];

  constructor(container?: HTMLElement) {
    this.selectEl = document.createElement("select");
    if (container) container.appendChild(this.selectEl);
  }

  addOptions(options: Record<string, string>): this {
    this.options = { ...this.options, ...options };
    this.selectEl.innerHTML = "";
    for (const [value, label] of Object.entries(this.options)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      this.selectEl.appendChild(option);
    }
    return this;
  }

  setValue(value: string): this {
    this.value = value;
    this.selectEl.value = value;
    return this;
  }

  getValue(): string {
    return this.selectEl.value ?? this.value;
  }

  onChange(handler: ChangeHandler<string>): this {
    this.onChangeHandlers.push(handler);
    return this;
  }

  async triggerChange(value: string): Promise<void> {
    this.setValue(value);
    for (const handler of this.onChangeHandlers) {
      await handler(value);
    }
  }
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
  async loadData(): Promise<any> {
    return null;
  }
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

  setName(_name: string): this {
    return this;
  }

  setDesc(_desc: string): this {
    return this;
  }

  addText(cb: (text: TextComponent) => void): this {
    const text = new TextComponent(this.containerEl);
    cb(text);
    return this;
  }

  addDropdown(cb: (dropdown: DropdownComponent) => void): this {
    const dropdown = new DropdownComponent(this.containerEl);
    cb(dropdown);
    return this;
  }

  addSlider(cb: (slider: SliderComponent) => void): this {
    const slider = new SliderComponent(this.containerEl);
    cb(slider);
    return this;
  }

  addToggle(cb: (toggle: ToggleComponent) => void): this {
    const toggle = new ToggleComponent(this.containerEl);
    cb(toggle);
    return this;
  }
}

export class ToggleComponent {
  toggleEl: HTMLInputElement;
  private value = false;
  private onChangeHandlers: ChangeHandler<boolean>[] = [];

  constructor(container?: HTMLElement) {
    this.toggleEl = document.createElement("input");
    this.toggleEl.type = "checkbox";
    if (container) container.appendChild(this.toggleEl);
    this.toggleEl.addEventListener("change", async () => {
      const checked = this.toggleEl.checked;
      this.value = checked;
      for (const handler of this.onChangeHandlers) {
        await handler(checked);
      }
    });
  }

  setValue(value: boolean): this {
    this.value = value;
    this.toggleEl.checked = value;
    return this;
  }

  onChange(handler: ChangeHandler<boolean>): this {
    this.onChangeHandlers.push(handler);
    return this;
  }
}

export function setIcon(_el: HTMLElement, _icon: string): void {}

export class Notice {
  message: string;
  timeout?: number;
  static all: Notice[] = [];

  constructor(message: string, timeout?: number) {
    this.message = message;
    this.timeout = timeout;
    (this.constructor as typeof Notice).all.push(this);
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
