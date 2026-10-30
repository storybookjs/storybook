import { COMPONENT_BLOCK_TAG } from '../constants.ts';
import type { ComponentProps } from '../parser/types.ts';

export type BlockMount = {
  render: (component: unknown, props: Record<string, unknown>) => void;
  unmount: () => void;
};

export type ComponentBlocks = {
  components: Record<string, unknown>;
  mount: (container: HTMLElement) => BlockMount;
};

type BlockElement = HTMLElement & {
  blockProps?: ComponentProps;
  blockText?: string;
  refresh: () => void;
};

const sheets = new Map<string, CSSStyleSheet>();
const shadowRoots = new Set<ShadowRoot>();
const elements = new Set<BlockElement>();
let registered: ComponentBlocks | undefined;

// Same signature as Vite's client `updateStyle`, which dev CSS modules call.
export function updateStyle(id: string, css: string): void {
  let sheet = sheets.get(id);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheets.set(id, sheet);
  }
  sheet.replaceSync(scopeToHost(css));
  adoptStyles();
}

export function removeStyle(id: string): void {
  sheets.delete(id);
  adoptStyles();
}

// `:root` matches nothing inside a shadow tree; the host is the closest equivalent.
export function scopeToHost(css: string): string {
  return css.replace(/:root\b/g, ':host');
}

export function defineManagerDocsBlocks(blocks: ComponentBlocks): void {
  registered = blocks;
  if (!customElements.get(COMPONENT_BLOCK_TAG)) {
    customElements.define(COMPONENT_BLOCK_TAG, createBlockElement());
  }
  for (const element of elements) {
    element.refresh();
  }
}

function adoptStyles() {
  for (const root of shadowRoots) {
    root.adoptedStyleSheets = [...sheets.values()];
  }
}

function createBlockElement() {
  return class ManagerDocsBlockElement extends HTMLElement implements BlockElement {
    #props: ComponentProps | undefined;
    #text: string | undefined;
    #mount: { blocks: ComponentBlocks; mounted: BlockMount } | undefined;

    constructor() {
      super();
      // The manager may set these before the element is defined; reapply them through the setters.
      for (const key of ['blockProps', 'blockText'] as const) {
        if (Object.hasOwn(this, key)) {
          const value = this[key];
          Reflect.deleteProperty(this, key);
          this[key] = value as never;
        }
      }
    }

    get blockProps() {
      return this.#props;
    }

    set blockProps(props: ComponentProps | undefined) {
      this.#props = props;
      this.refresh();
    }

    get blockText() {
      return this.#text;
    }

    set blockText(text: string | undefined) {
      this.#text = text;
      this.refresh();
    }

    connectedCallback() {
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      shadowRoots.add(root);
      root.adoptedStyleSheets = [...sheets.values()];
      elements.add(this);
      this.refresh();
    }

    disconnectedCallback() {
      elements.delete(this);
      if (this.shadowRoot) {
        shadowRoots.delete(this.shadowRoot);
      }
      this.#mount?.mounted.unmount();
      this.#mount = undefined;
    }

    refresh() {
      const root = this.shadowRoot;
      const blocks = registered;
      if (!this.isConnected || !root || !blocks || this.#props === undefined) {
        return;
      }
      const blockId = this.dataset.blockId ?? '';
      const component = blocks.components[blockId];
      let mount = this.#mount;
      if (!component) {
        mount?.mounted.unmount();
        this.#mount = undefined;
        root.textContent = `No component is registered for "${blockId}".`;
        return;
      }
      if (mount?.blocks !== blocks) {
        mount?.mounted.unmount();
        root.textContent = '';
        const container = document.createElement('div');
        root.append(container);
        mount = { blocks, mounted: blocks.mount(container) };
        this.#mount = mount;
      }
      const props =
        this.#text === undefined ? this.#props : { ...this.#props, children: this.#text };
      mount.mounted.render(component, props);
    }
  };
}
