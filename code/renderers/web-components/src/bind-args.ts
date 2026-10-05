import type { Args } from 'storybook/internal/types';

import { DEFAULT_SLOT_NAME, parseArgKey, type ArgKeyCategory } from './arg-keys.ts';

type Binder = (element: HTMLElement, name: string, value: unknown) => string | undefined;

const BINDERS: Record<Exclude<ArgKeyCategory, 'cssProperties'>, Binder> = {
  events: (element, name, value) => {
    if (typeof value === 'function') {
      element.addEventListener(name, value as EventListener);
    }
  },
  methods: () => undefined,
  slots: bindSlot,
  cssParts: (element, name, value) => styleRule(`${element.localName}::part(${name})`, value),
  cssStates: (element, name, value) => styleRule(`${element.localName}:state(${name})`, value),
};

// Element properties win over attributes so booleans that default to `true` and empty strings reach the element; runtime checks run before suffixes so a declared attribute such as `has-slot` wins, as in the mapper.
export function bindArgs(element: HTMLElement, args: Args): string[] {
  const observedAttributes = observedAttributesOf(element);
  const styleRules: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    const parsedKey = parseArgKey(key);

    if (parsedKey?.category === 'cssProperties') {
      bindCssCustomProperty(element, key, value);
      continue;
    }

    if (key in element) {
      assignProperty(element, key, value);
      continue;
    }

    if (observedAttributes.has(key) && isPrimitive(value)) {
      bindAttribute(element, key, value);
      continue;
    }

    if (parsedKey) {
      const rule = BINDERS[parsedKey.category](element, parsedKey.name, value);
      if (rule) {
        styleRules.push(rule);
      }
      continue;
    }

    assignProperty(element, key, value);
  }

  return styleRules;
}

function observedAttributesOf(element: HTMLElement): Set<string> {
  const constructor = customElements.get(element.localName) as
    | { observedAttributes?: unknown }
    | undefined;
  const observedAttributes = constructor?.observedAttributes;
  return new Set(Array.isArray(observedAttributes) ? observedAttributes : []);
}

function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function assignProperty(element: HTMLElement, key: string, value: unknown): void {
  (element as HTMLElement & Record<string, unknown>)[key] = value;
}

function bindAttribute(element: HTMLElement, name: string, value: unknown): void {
  if (isUnset(value) || value === false) {
    return;
  }

  element.setAttribute(name, value === true ? '' : String(value));
}

function bindCssCustomProperty(element: HTMLElement, name: string, value: unknown): void {
  if (!isUnset(value)) {
    element.style.setProperty(name, String(value));
  }
}

function bindSlot(element: HTMLElement, name: string, value: unknown): undefined {
  if (isUnset(value)) {
    return undefined;
  }

  const template = document.createElement('template');
  template.innerHTML = String(value);
  const nodes = Array.from(template.content.childNodes);

  if (name === DEFAULT_SLOT_NAME) {
    element.append(...nodes);
    return undefined;
  }

  for (const node of nodes) {
    const slottedNode = toNamedSlotNode(node, name);

    if (slottedNode) {
      element.append(slottedNode);
    }
  }

  return undefined;
}

function toNamedSlotNode(node: ChildNode, name: string): ChildNode | undefined {
  if (node.nodeType === Node.ELEMENT_NODE) {
    (node as HTMLElement).slot = name;
    return node;
  }

  if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
    const span = document.createElement('span');
    span.slot = name;
    span.textContent = node.textContent;
    return span;
  }

  return undefined;
}

function styleRule(selector: string, value: unknown): string | undefined {
  if (isUnset(value)) {
    return undefined;
  }

  return `${selector} { ${String(value)} }`;
}
