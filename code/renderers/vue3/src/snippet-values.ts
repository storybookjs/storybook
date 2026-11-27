// How a Vue story snippet prints an arg's value where it stands. The story-docs provider prints
// the static snippet with these, from the value the story writes, and the preview's filler prints a
// template's holes with them, from the value a control sets, so the two print a value alike. Where
// one returns `undefined`, the static snippet declares the value in `<script setup>` or prints no
// snippet; the filler writes it in place, escaped as Vue reads it there.

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

// A string as a quoted attribute value. An attribute decodes entities, so a string with `&` would
// read differently, as would one with both quotes.
export function quoteAttributeValue(value: string): string | undefined {
  if (value.includes('&')) {
    return undefined;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  return undefined;
}

// The value as the attribute `name`: bare while `true`, quoted for a string, bound otherwise.
export function printAttribute(name: string, value: SnippetValue): string | undefined {
  switch (value.kind) {
    case 'boolean':
      return value.value ? name : `:${name}="false"`;
    case 'string': {
      const quoted = quoteAttributeValue(value.value);
      return quoted === undefined ? undefined : `${name}=${quoted}`;
    }
    default:
      return `:${name}="${value.code}"`;
  }
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

// The text an `{{ args.x }}` interpolation shows, which only a literal has.
export function interpolatedText(value: SnippetValue): string | undefined {
  return value.kind === 'code' ? undefined : escapeTextContent(String(value.value));
}

// A slot's content: a literal as text, unless Vue would condense its padding, else code in an
// interpolation.
export function slotContent(value: SnippetValue): string | undefined {
  if (value.kind === 'code') {
    const code = expressionCode(value.code, undefined);
    return code === undefined ? undefined : `{{ ${code} }}`;
  }
  const text = String(value.value);
  return /^\s|\s$/.test(text) ? undefined : escapeTextContent(text);
}

// Code where a template expression reads an arg: in an attribute value quoted with `quote`, or in
// an interpolation without one. Vue decodes entities there, and the quote or `}}` would end it.
export function expressionCode(code: string, quote: '"' | "'" | undefined): string | undefined {
  return (quote && code.includes(quote)) || code.includes('}}') || code.includes('&')
    ? undefined
    : code;
}

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
