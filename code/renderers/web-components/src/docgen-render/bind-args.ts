import type { Args, Parameters, StrictArgTypes, StrictInputType } from 'storybook/internal/types';

import { action } from 'storybook/actions';

import { ARG_TYPE_CATEGORIES, type ArgTypeCategory } from '../arg-type-categories.ts';

const DEFAULT_SLOT_NAME = 'default';

/** Bind args by the category of the server docgen argTypes and return the node to mount. */
export function bindArgs(
  element: HTMLElement,
  args: Args,
  argTypes: StrictArgTypes,
  parameters: Parameters
): Node {
  const styleRules: string[] = [];

  for (const [key, argType] of Object.entries(argTypes)) {
    const eventName = actionEventName(argType);
    if (!eventName) {
      continue;
    }

    if (Object.hasOwn(args, key)) {
      const value = args[key];
      if (typeof value === 'function') {
        element.addEventListener(eventName, value as EventListener);
      }
    } else if (!parameters.actions?.disable) {
      element.addEventListener(eventName, action(key));
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const argType = argTypes[key];

    if (!argType) {
      assignProperty(element, key, value);
      continue;
    }

    if (actionEventName(argType)) {
      continue;
    }

    const name = argType.name;
    const category = argType.table?.category as ArgTypeCategory | undefined;

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
      case ARG_TYPE_CATEGORIES.events:
      case ARG_TYPE_CATEGORIES.methods:
      case undefined:
        break;
      default:
        assertKnownCategory(category);
        assignProperty(element, key, value);
    }
  }

  if (styleRules.length === 0) {
    return element;
  }

  const fragment = document.createDocumentFragment();
  const style = document.createElement('style');
  style.textContent = `@scope {\n  ${styleRules.join('\n  ')}\n}`;
  fragment.append(style, element);

  return fragment;
}

function assertKnownCategory(_category: never): void {}

function actionEventName(argType: StrictInputType): string | undefined {
  return typeof argType.action?.name === 'string' ? argType.action.name : undefined;
}

function assignProperty(element: HTMLElement, key: string, value: unknown): void {
  (element as HTMLElement & Record<string, unknown>)[key] = value;
}

function bindAttribute(element: HTMLElement, argType: StrictInputType, value: unknown): void {
  if (value === undefined || value === null || value === false) {
    return;
  }

  if (value === true) {
    element.setAttribute(argType.name, '');
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

// A prelude-less `@scope` limits rules to the `<style>`'s parent, so stories sharing a page do not style each other.
function scopedCssRule(
  element: HTMLElement,
  selectorSuffix: string,
  value: unknown
): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return `${element.localName}${selectorSuffix} { ${String(value)} }`;
}
