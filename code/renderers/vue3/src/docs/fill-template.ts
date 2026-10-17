import {
  type FillSnippetTemplate,
  UnprintableArgError,
  defaultCode,
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
// starts a statement after one without a `;`, a `'` word one in an attribute value written in
// single quotes, and a `{{` word one in an interpolation.
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
        return (
          (args[first] === undefined ? defaultCode(rest.at(-1)) : undefined) ??
          startingStatement(value(first, args[first], rest), rest)
        );
    }
  });

const startingStatement = (printed: string, words: string[]) =>
  words.includes(';') && /^[[(`+\-/]/.test(printed) ? `;${printed}` : printed;

// The element is the whole of the snippet's `<template>`, so its slots are indented one further. A
// slot the story writes as more than a literal comes as the content the provider printed for it;
// see `componentTemplate`.
function slots(name: string, slotNames: string[], args: Args): string {
  const content = slotNames
    .map((slot) => [slot, writtenCode(args[slot]) ?? text(slot, args[slot])])
    .filter(([, printed]) => printed)
    .map(([slot, printed]) =>
      slot === 'default'
        ? printed.replaceAll('\n', '\n    ')
        : `<template #${slot}>\n      ${printed.replaceAll('\n', '\n      ')}\n    </template>`
    );
  return content.length === 0
    ? ' />'
    : `>\n${content.map((line) => `    ${line}\n`).join('')}  </${name}>`;
}

// The code of a `writtenArg`.
const writtenCode = (arg: unknown) =>
  typeof arg === 'object' && arg !== null && WRITTEN in arg ? printValue(arg, '') : undefined;

const WRITTEN = Symbol.for('storybook/written-arg');

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
  if (!/^[A-Za-z_][\w:-]*$/.test(name)) {
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
  if (typeof arg === 'number' || (typeof arg === 'string' && /^\S+( \S+)*$/.test(arg))) {
    return String(arg)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('{{', '{&#123;')
      .replace(/\{$/, '&#123;');
  }
  return `{{ ${value(name, arg, ['{{'])} }}`;
}

// A literal in an attribute value or an interpolation, both of which decode entities, so it is
// written in the quote the attribute is not, and `<\/` keeps a string in the `<script>` from ending
// the block. A VNode is a plain object, but no literal renders it. In an interpolation, the `{{`
// word, `}\}` keeps a string's `}}` from ending it, and a space other code's, such as `{a:{b:1}}` the
// story wrote.
function value(name: string, arg: unknown, words: string[] = []) {
  const singleQuoted = words.includes("'");
  const printed = printValue(arg, name, { quote: singleQuoted ? '"' : "'", opaque: isVNode });
  if (words.includes('script')) {
    return printed.replaceAll('</', '<\\/');
  }
  const closed = words.includes('{{')
    ? printed.replace(/}(?=})/g, typeof arg === 'string' ? '}\\' : '} ')
    : printed;
  const escaped = closed.replaceAll('&', '&amp;');
  return singleQuoted ? escaped.replaceAll("'", '&#39;') : escaped.replaceAll('"', '&quot;');
}
