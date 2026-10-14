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

// Fills a Vue story template. Besides the shared holes, `⟦slots Card default header⟧` ends the open
// tag of `Card` with the slots its words name as content, or closes it without any. A `script` word marks a
// `⟦value⟧` or `⟦operand⟧` hole in the `<script>`, where no entity is decoded, a `;` word one that
// starts a statement after one without a `;`, and a `'` word one in an attribute value written in
// single quotes.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', ...rest] = words;
    switch (kind) {
      case 'slots':
        return slots(first, rest, args);
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
function slots(name: string, slotNames: string[], args: Args): string {
  const content = slotNames
    .map((slot) => [slot, text(slot, args[slot])])
    .filter(([, printed]) => printed)
    .map(([slot, printed]) =>
      slot === 'default' ? printed : `<template #${slot}>\n      ${printed}\n    </template>`
    );
  return content.length === 0
    ? ' />'
    : `>\n${content.map((line) => `    ${line}\n`).join('')}  </${name}>`;
}

const spread = (args: Args, words: string[]) =>
  attributesOf(spreadArgs(args, words).sort(([a], [b]) => a.localeCompare(b)));

const attributesOf = (props: [string, unknown][]) =>
  props
    .map(([name, arg]) => attribute(name, arg))
    .filter(Boolean)
    .join(' ');

function attribute(name: string, arg: unknown): string {
  if (arg === undefined || isAction(arg)) {
    return '';
  }
  if (arg === true) {
    return checkedName(name);
  }
  return typeof arg === 'string'
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
// the text before an interpolation. `}\}` keeps a string from ending the interpolation.
function text(name: string, arg: unknown): string {
  if (arg === undefined || arg === null || arg === '') {
    return '';
  }
  const plain = typeof arg === 'number' || (typeof arg === 'string' && /^\S+( \S+)*$/.test(arg));
  return plain
    ? String(arg)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('{{', '{&#123;')
        .replace(/\{$/, '&#123;')
    : `{{ ${value(name, arg).replaceAll('}}', '}\\}')} }}`;
}

// A literal in an attribute value or an interpolation, both of which decode entities, so it is
// written in the quote the attribute is not, and `<\/` keeps a string in the `<script>` from ending
// the block. A VNode is a plain object, but no literal renders it.
function value(name: string, arg: unknown, words: string[] = []) {
  const singleQuoted = words.includes("'");
  const printed = printValue(arg, name, { quote: singleQuoted ? '"' : "'", opaque: isVNode });
  if (words.includes('script')) {
    return printed.replaceAll('</', '<\\/');
  }
  const escaped = printed.replaceAll('&', '&amp;');
  return singleQuoted ? escaped.replaceAll("'", '&#39;') : escaped.replaceAll('"', '&quot;');
}
