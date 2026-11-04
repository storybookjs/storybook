import { printValue } from 'storybook/internal/docs-tools';

// How a Vue story snippet prints an arg's value where it stands. The story-docs provider prints
// the static snippet with these, from the value the story writes, and the preview's filler prints a
// template's holes with them, from the value a control sets, so the two print a value alike: in
// place, escaped as Vue reads it there.

// Where a hole of a story's template stands, which the provider writes and `printHole` prints a
// changed arg for:
//
// - `attr`: the attribute `name`, the arg's own name unless it says otherwise, left out while the
//   arg is unset.
// - `props`: the args a control set, as an args binding passes them, but those in `except`, which
//   the element prints already.
// - `slots`: the slots in `slots`, which a story without a render function leaves unset, that a
//   control set, as children of its component, indented by `indent`. With `tag`, the hole is the
//   end of the self-closing tag, which it opens to hold them.
// - `text`: the text of an interpolation, or with `slot`, a slot's content.
// - `value`: code. In `script`, the whole value a `<script setup>` const or `ref()` declares; in a
//   setup `statement`, an `interpolation` or an `attribute` value quoted with `quote`, an operand,
//   in parentheses where the code around it would read it otherwise. `readsOn` says that code
//   reads on after it with a `.`, as `(5).toFixed()` does.
export type VueHolePlace =
  | AttrPlace
  | { kind: 'props'; except: string[] }
  | { kind: 'slots'; slots: string[]; indent: string; tag?: string }
  | { kind: 'text'; slot?: boolean }
  | ValuePlace;

type AttrPlace = { kind: 'attr'; name?: string };
type ValuePlace = { kind: 'value'; readsOn?: boolean } & (
  | { in: 'script' | 'statement' | 'interpolation' }
  | { in: 'attribute'; quote: '"' | "'" }
);

// A value as the snippet prints it: a literal whose value it prints, or code it prints as is.
export type SnippetValue =
  | { kind: 'boolean'; value: boolean }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number; code: string }
  | { kind: 'code'; code: string };

// The order the snippet writes the props of an args binding in.
export const attributeOrder = (a: string, b: string) => a.localeCompare(b);

// The order the snippet writes slots in: the default slot first, then by name.
export const slotOrder = (a: string, b: string) =>
  a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b);

// A value as code, a string in `quote`.
export const codeOf = (value: SnippetValue, quote: '"' | "'" = "'") =>
  value.kind === 'string'
    ? printValue(value.value, '', { quote })
    : value.kind === 'boolean'
      ? String(value.value)
      : value.code;

// Code or text in an attribute value quoted with `quote`, where Vue decodes entities.
export const inAttribute = (text: string, quote: '"' | "'") =>
  text.replaceAll('&', '&amp;').replaceAll(quote, quote === '"' ? '&quot;' : '&#39;');

// Code in an interpolation, where Vue decodes entities and `}}` ends it. Printed code writes `}}`
// only in a string, where `}\}` reads the same.
export const inInterpolation = (text: string) =>
  text.replaceAll('&', '&amp;').replace(/}(?=})/g, '}\\');

// The value as the attribute `name`: bare while `true`, quoted for a string, in the quote it does
// not hold if it holds one, bound otherwise.
export function printAttribute(name: string, value: SnippetValue): string {
  if (value.kind === 'boolean') {
    return value.value ? name : `:${name}="false"`;
  }
  if (value.kind !== 'string') {
    return `:${name}="${inAttribute(value.code, '"')}"`;
  }
  const quote = value.value.includes('"') && !value.value.includes("'") ? "'" : '"';
  return `${name}=${quote}${inAttribute(value.value, quote)}${quote}`;
}

// Text as it reads back once Vue compiles the snippet: `<` would open a tag and `{{` an
// interpolation.
export function escapeTextContent(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('{{', '&#123;&#123;');
}

// The text an `{{ args.x }}` interpolation shows, a `{` it ends with escaped, as code after it may
// open an interpolation; code shows as an interpolation of its own.
export const printText = (value: SnippetValue) =>
  value.kind === 'code'
    ? interpolation(value)
    : escapeTextContent(String(value.value)).replace(/\{$/, '&#123;');

// A slot's content: a literal as text, unless Vue would condense its padding, else code in an
// interpolation.
export const printSlot = (value: SnippetValue) =>
  value.kind === 'code' || /^\s|\s$/.test(String(value.value))
    ? interpolation(value)
    : escapeTextContent(String(value.value));

const interpolation = (value: SnippetValue) => `{{ ${inInterpolation(codeOf(value))} }}`;

// Code in parentheses where the code around it reads it otherwise: `-1`, an object, which would
// open a block after `=>`, or `5` in `5.toFixed()`.
export function operand(code: string, readsOn: boolean): string {
  return code.startsWith('-') || code.startsWith('{') || (readsOn && /^\d/.test(code))
    ? `(${code})`
    : code;
}

// A slot's content as a child of its component: a named slot in a `<template>`.
export function wrapSlotContent(name: string, content: string): string {
  return name === 'default' ? content : `<template #${name}>\n${indent(content)}\n</template>`;
}

export function indent(source: string, by = '  '): string {
  return source
    .split('\n')
    .map((line) => (line ? `${by}${line}` : line))
    .join('\n');
}
