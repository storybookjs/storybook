import {
  type FillSnippetTemplate,
  UnprintableArgError,
  asOperand,
  fillHoles,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { isVNode } from 'vue';

// Fills a Vue story template. Besides the shared holes, `⟦element Card default header⟧` is the
// component with every arg and the slots its words name as content, and a `⟦value open script⟧` or
// `⟦operand open script⟧` hole is in the `<script>`, where no entity is decoded.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = ''] = words;
    switch (kind) {
      case 'element':
        return element(first, words.slice(1), args);
      case 'props':
        return attributesOf(spreadArgs(args, words));
      case 'attr':
        return attribute(first, args[second]);
      case 'text':
        return text(first, args[first]);
      case 'operand':
        return asOperand(value(first, args[first], second));
      default:
        return value(first, args[first], second);
    }
  });

// The element is the whole of the snippet's `<template>`, so its slots are indented one further.
function element(name: string, slots: string[], args: Args): string {
  const content = slots
    .map((slot) => [slot, text(slot, args[slot])])
    .filter(([, printed]) => printed)
    .map(([slot, printed]) =>
      slot === 'default' ? printed : `<template #${slot}>${printed}</template>`
    );
  const props = Object.entries(args).filter(([prop]) => !slots.includes(prop));
  const open = `<${[name, attributesOf(props)].filter(Boolean).join(' ')}`;
  return content.length === 0
    ? `${open} />`
    : `${open}>\n${content.map((line) => `    ${line}\n`).join('')}  </${name}>`;
}

const attributesOf = (props: [string, unknown][]) =>
  props
    .map(([name, arg]) => attribute(name, arg))
    .filter(Boolean)
    .join(' ');

// A function arg, such as an action, is left out, as no control changes it.
function attribute(name: string, arg: unknown): string {
  if (arg === undefined || arg === null || typeof arg === 'function') {
    return '';
  }
  if (!/^[A-Za-z_][\w-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
  // Vue reads a bare `is` and an `is="vue:…"` attribute as the element's component, so those bind.
  const namesComponent =
    name === 'is' && (arg === true || (typeof arg === 'string' && arg.startsWith('vue:')));
  if (arg === true && !namesComponent) {
    return name;
  }
  return typeof arg === 'string' && !namesComponent
    ? `${name}="${arg.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`
    : `:${name}="${value(name, arg)}"`;
}

// Vue collapses whitespace in text and reads `<`, `{{` and `&` as markup.
function text(name: string, arg: unknown): string {
  if (arg === undefined || arg === null || arg === '') {
    return '';
  }
  const plain = typeof arg === 'number' || (typeof arg === 'string' && /^\S(.*\S)?$/.test(arg));
  return plain
    ? String(arg).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('{{', '{&#123;')
    : `{{ ${value(name, arg)} }}`;
}

// A literal in an attribute value or an interpolation, both of which decode entities; `}\}` keeps a
// string from ending the interpolation, and `<\/` one in the `<script>` from ending the block. A
// VNode is a plain object, but no literal renders it.
function value(name: string, arg: unknown, where?: string) {
  const printed = printValue(arg, name, { quote: "'", opaque: isVNode });
  return where === 'script'
    ? printed.replaceAll('</', '<\\/')
    : printed.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('}}', '}\\}');
}
