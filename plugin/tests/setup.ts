interface CreateOptions {
  cls?: string;
  text?: string;
  attr?: Record<string, string>;
}

declare global {
  interface HTMLElement {
    empty(): void;
    createDiv(options?: CreateOptions): HTMLDivElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: CreateOptions,
    ): HTMLElementTagNameMap[K];
    createSpan(options?: CreateOptions): HTMLSpanElement;
  }
}

function applyOptions<T extends HTMLElement>(element: T, options?: CreateOptions): T {
  if (!options) return element;
  if (options.cls) {
    element.className = options.cls;
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  if (options.attr) {
    for (const [key, value] of Object.entries(options.attr)) {
      element.setAttribute(key, value);
    }
  }
  return element;
}

HTMLElement.prototype.empty = function empty() {
  while (this.firstChild) {
    this.removeChild(this.firstChild);
  }
};

HTMLElement.prototype.createDiv = function createDiv(options?: CreateOptions) {
  const div = document.createElement("div");
  applyOptions(div, options);
  this.appendChild(div);
  return div;
};

HTMLElement.prototype.createEl = function createEl(tag, options) {
  const element = document.createElement(tag);
  applyOptions(element, options);
  this.appendChild(element);
  return element;
};

HTMLElement.prototype.createSpan = function createSpan(options?: CreateOptions) {
  return this.createEl("span", options);
};

export {};
