import type { Args } from 'storybook/internal/types';

import { ARG_KEY_SUFFIXES, type ArgKeySuffix } from './arg-key-suffixes.ts';

type SuffixBinder = (
  element: HTMLElement,
  name: string,
  value: unknown,
  styleRules: string[]
) => void;

const DEFAULT_SLOT_NAME = 'default';

const SUFFIX_BINDERS: Record<ArgKeySuffix, SuffixBinder> = {
  [ARG_KEY_SUFFIXES.events]: (element, name, value) => {
    if (typeof value === 'function') {
      element.addEventListener(name, value as EventListener);
    }
  },
  [ARG_KEY_SUFFIXES.methods]: () => {},
  [ARG_KEY_SUFFIXES.slots]: bindSlot,
  [ARG_KEY_SUFFIXES.cssParts]: (element, name, value, styleRules) =>
    pushStyleRule(styleRules, `${element.localName}::part(${name})`, value),
  [ARG_KEY_SUFFIXES.cssStates]: (element, name, value, styleRules) =>
    pushStyleRule(styleRules, `${element.localName}:state(${name})`, value),
};

// Runtime attribute/property checks run before suffixes, so a declared attribute such as `has-slot` wins, as in the mapper.
export function bindArgs(element: HTMLElement, args: Args): DocumentFragment {
  const observedAttributes = observedAttributesOf(element);
  const styleRules: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    if (key.startsWith('--')) {
      bindCssCustomProperty(element, key, value);
      continue;
    }

    if (observedAttributes.has(key) && isPrimitive(value)) {
      bindAttribute(element, key, value);
      continue;
    }

    if (key in element) {
      assignProperty(element, key, value);
      continue;
    }

    const suffixBinding = Object.entries(SUFFIX_BINDERS).find(([suffix]) => key.endsWith(suffix));
    if (suffixBinding) {
      const [suffix, bind] = suffixBinding;
      bind(element, key.slice(0, -suffix.length), value, styleRules);
      continue;
    }

    assignProperty(element, key, value);
  }

  const fragment = document.createDocumentFragment();
  if (styleRules.length > 0) {
    // A prelude-less `@scope` limits rules to the `<style>`'s parent, and `:scope > style +` to the element right after it, so sibling instances and other stories stay unstyled.
    const style = document.createElement('style');
    style.textContent = `@scope {\n  ${styleRules.join('\n  ')}\n}`;
    fragment.append(style);
  }
  fragment.append(element);

  return fragment;
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

function bindSlot(element: HTMLElement, name: string, value: unknown): void {
  if (isUnset(value)) {
    return;
  }

  const template = document.createElement('template');
  template.innerHTML = String(value);
  const nodes = Array.from(template.content.childNodes);

  if (name === DEFAULT_SLOT_NAME) {
    element.append(...nodes);
    return;
  }

  for (const node of nodes) {
    const slottedNode = toNamedSlotNode(node, name);

    if (slottedNode) {
      element.append(slottedNode);
    }
  }
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

function pushStyleRule(styleRules: string[], selector: string, value: unknown): void {
  if (!isUnset(value)) {
    styleRules.push(`:scope > style + ${selector} { ${String(value)} }`);
  }
}
