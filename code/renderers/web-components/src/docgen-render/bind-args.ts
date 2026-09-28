import type { Args, StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { ARG_TYPE_CATEGORIES } from '../docgen/component-docgen/arg-types/categories.ts';

const BOOLEAN_TYPE_NAME = 'boolean';
const DEFAULT_SLOT_NAME = 'default';

/** Bind args by the category of the server docgen argTypes and return the node to mount. */
export function bindArgs(element: HTMLElement, args: Args, argTypes: StrictArgTypes): Node {
  const styleRules: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    const argType = argTypes[key];

    if (!argType) {
      assignProperty(element, key, value);
      continue;
    }

    const eventName = actionEventName(argType);
    if (eventName) {
      if (typeof value === 'function') {
        element.addEventListener(eventName, value as EventListener);
      }
      continue;
    }

    const name = argType.name;
    const category = argType.table?.category;

    switch (category) {
      case ARG_TYPE_CATEGORIES.attributes:
        bindAttribute(element, argType, value);
        break;
      case ARG_TYPE_CATEGORIES.properties:
        assignProperty(element, name, value);
        break;
      case ARG_TYPE_CATEGORIES.cssProperties:
        bindCssCustomProperty(element, name, value);
        break;
      case ARG_TYPE_CATEGORIES.slots:
        bindSlot(element, name, value);
        break;
      case ARG_TYPE_CATEGORIES.cssParts:
      case ARG_TYPE_CATEGORIES.cssStates: {
        const suffix =
          category === ARG_TYPE_CATEGORIES.cssParts ? `::part(${name})` : `:state(${name})`;
        const rule = scopedCssRule(element, suffix, value);
        if (rule) {
          styleRules.push(rule);
        }
        break;
      }
    }
  }

  if (styleRules.length === 0) {
    return element;
  }

  const fragment = document.createDocumentFragment();
  const style = document.createElement('style');
  style.textContent = styleRules.join('\n');
  fragment.append(style, element);

  return fragment;
}

/** The DOM event an action twin row listens to; `undefined` for the string form and non-twin rows. */
export function actionEventName(argType: StrictInputType): string | undefined {
  return typeof argType.action?.name === 'string' ? argType.action.name : undefined;
}

function assignProperty(element: HTMLElement, key: string, value: unknown): void {
  (element as HTMLElement & Record<string, unknown>)[key] = value;
}

/** Toggle booleans by type or value; serialize object values as JSON. */
function bindAttribute(element: HTMLElement, argType: StrictInputType, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (argType.type?.name === BOOLEAN_TYPE_NAME || typeof value === 'boolean') {
    if (value) {
      element.setAttribute(argType.name, '');
    } else {
      element.removeAttribute(argType.name);
    }
    return;
  }

  element.setAttribute(
    argType.name,
    typeof value === 'object' ? JSON.stringify(value) : String(value)
  );
}

function bindCssCustomProperty(element: HTMLElement, name: string, value: unknown): void {
  if (value !== undefined && value !== '') {
    element.style.setProperty(name, String(value));
  }
}

function bindSlot(element: HTMLElement, name: string, value: unknown): void {
  if (value === undefined || value === '') {
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

/** The `<style>` is the element's previous sibling, so `+` scopes rules to this instance without a docs-visible attribute. */
function scopedCssRule(
  element: HTMLElement,
  selectorSuffix: string,
  value: unknown
): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return `style + ${element.localName}${selectorSuffix} { ${String(value)} }`;
}
