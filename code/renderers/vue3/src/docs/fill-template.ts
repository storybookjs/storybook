import {
  type FillSnippetTemplate,
  UnprintableArgError,
  asOperand,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { isVNode } from 'vue';

// Fills a Vue story template. Besides the shared holes, `⟦element Card default header⟧` is the
// component with every arg and the slots its words name as content. A `script` word marks a
// `⟦value⟧` or `⟦operand⟧` hole in the `<script>`, where no entity is decoded, a `;` word one that
// starts a statement after one without a `;`, and a `'` word one in an attribute value written in
// single quotes. A `+class` word on `⟦props⟧` is an arg Vue merges
// with the `class` the element writes itself, and `+:class` one merged with its `:class`.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', ...rest] = words;
    switch (kind) {
      case 'element':
        return element(first, rest, args);
      case 'props':
        return spread(args, words);
      case 'attr':
        return attribute(first, args[rest[0]!]);
      case 'text':
        return text(first, args[first]);
      case 'operand':
        return startingStatement(asOperand(value(first, args[first], rest)), rest);
      default:
        return startingStatement(value(first, args[first], rest), rest);
    }
  });

const startingStatement = (printed: string, words: string[]) =>
  words.includes(';') && /^[[(`+\-/]/.test(printed) ? `;${printed}` : printed;

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

function spread(args: Args, words: string[]): string {
  const merged = words.filter((word) => word.startsWith('+')).map((word) => word.slice(1));
  const props = spreadArgs(
    args,
    words.filter((word) => !word.startsWith('+'))
  ).filter(([name]) => !merged.includes(name) && !merged.includes(`:${name}`));
  const merges = merged.map((written) => {
    const name = written.replace(/^:/, '');
    const arg = args[name];
    if (arg === undefined || isAction(arg)) {
      return '';
    }
    // The element binds `:class` itself, so the arg can only be the written `class`.
    if (written.startsWith(':') && typeof arg !== 'string') {
      throw new UnprintableArgError(name);
    }
    return written.startsWith(':') ? attribute(name, arg) : bound(name, arg);
  });
  return [attributesOf(props), ...merges].filter(Boolean).join(' ');
}

const attributesOf = (props: [string, unknown][]) =>
  props
    .map(([name, arg]) => attribute(name, arg))
    .filter(Boolean)
    .join(' ');

function attribute(name: string, arg: unknown): string {
  if (arg === undefined || isAction(arg)) {
    return '';
  }
  // Vue reads a bare `is` and an `is="vue:…"` attribute as the element's component, so those bind.
  const namesComponent =
    name === 'is' && (arg === true || (typeof arg === 'string' && arg.startsWith('vue:')));
  if (arg === true && !namesComponent) {
    return checkedName(name);
  }
  return typeof arg === 'string' && !namesComponent
    ? `${checkedName(name)}="${arg.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`
    : bound(name, arg);
}

const bound = (name: string, arg: unknown) => `:${checkedName(name)}="${value(name, arg)}"`;

function checkedName(name: string) {
  if (!/^[A-Za-z_][\w-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
  return name;
}

// Vue collapses whitespace in text and reads `<`, `{{` and `&` as markup, as well as a `{` that ends
// the text before an interpolation.
function text(name: string, arg: unknown): string {
  if (arg === undefined || arg === null || arg === '') {
    return '';
  }
  const plain = typeof arg === 'number' || (typeof arg === 'string' && /^\S+( \S+)*$/.test(arg));
  return plain
    ? String(arg)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('{{', '{&#123;')
        .replace(/\{$/, '&#123;')
    : `{{ ${value(name, arg)} }}`;
}

// A literal in an attribute value or an interpolation, both of which decode entities, so it is
// written in the quote the attribute is not; `}\}` keeps a string from ending the interpolation,
// and `<\/` one in the `<script>` from ending the block. A VNode is a plain object, but no literal
// renders it.
function value(name: string, arg: unknown, words: string[] = []) {
  const singleQuoted = words.includes("'");
  const printed = printValue(arg, name, { quote: singleQuoted ? '"' : "'", opaque: isVNode });
  if (words.includes('script')) {
    return printed.replaceAll('</', '<\\/');
  }
  const escaped = printed.replaceAll('&', '&amp;').replaceAll('}}', '}\\}');
  return singleQuoted ? escaped.replaceAll("'", '&#39;') : escaped.replaceAll('"', '&quot;');
}
