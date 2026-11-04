import { type PrintHole, printValue, unknownHoleKind } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { isVNode } from 'vue';

import {
  type SnippetValue,
  type VueHolePlace,
  attributeOrder,
  interpolatedText,
  indent,
  operand,
  printAttribute,
  slotContent,
  slotOrder,
  wrapSlotContent,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template of the Vue story-docs provider, with the printers
// the static snippet is printed with. `VueHolePlace` says what each place prints. Where the static
// snippet declares a value in `<script setup>`, as a string with `&` or both quotes, this writes it
// in place, escaped as Vue reads it there.
export const printHole: PrintHole<VueHolePlace> = (hole, value) => {
  const arg = hole.arg ?? '';
  switch (hole.kind) {
    case 'attr':
      return value === undefined ? '' : attribute(hole.name ?? arg, arg, value);
    case 'props':
      return Object.entries(value as Args)
        .filter(([name]) => !hole.except.includes(name))
        .sort(([a], [b]) => attributeOrder(a, b))
        .map(([name, item]) => attribute(name, name, item))
        .join(' ');
    case 'slots': {
      const set = hole.slots.filter((name) => Object.hasOwn(value as Args, name)).sort(slotOrder);
      if (set.length === 0) {
        return hole.tag ? ' />' : '';
      }
      const children = set
        .map((name) => wrapSlotContent(name, slot(name, (value as Args)[name])))
        .map((child) => indent(child, hole.indent))
        .join('\n');
      return hole.tag ? `>\n${children}\n${hole.indent.slice(2)}</${hole.tag}>` : `\n${children}`;
    }
    case 'text':
      return value === undefined ? '' : hole.slot ? slot(arg, value) : text(arg, value);
    case 'value': {
      const readsOn = hole.readsOn === true;
      if (hole.in === 'attribute') {
        const quote = hole.quote;
        return operand(inAttribute(code(arg, value, quote === "'" ? '"' : "'"), quote), readsOn);
      }
      const printed = code(arg, value, "'");
      if (hole.in === 'script') {
        return printed;
      }
      return operand(hole.in === 'interpolation' ? inInterpolation(printed) : printed, readsOn);
    }
    default:
      return unknownHoleKind(hole);
  }
};

const code = (name: string, value: unknown, quote: '"' | "'") =>
  printValue(value, name, { quote, opaque: isVNode });

// A value as the snippet prints it: a boolean, a string, a number it writes as is, or code.
function snippetValue(name: string, value: unknown): SnippetValue {
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value };
  }
  if (typeof value === 'string') {
    return { kind: 'string', value };
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && !Object.is(value, -0)) {
    return { kind: 'number', value, code: String(value) };
  }
  return { kind: 'code', code: code(name, value, "'") };
}

// Code or text in an attribute value quoted with `quote`, where Vue decodes entities.
const inAttribute = (text: string, quote: '"' | "'") =>
  text.replaceAll('&', '&amp;').replaceAll(quote, quote === '"' ? '&quot;' : '&#39;');

// Code in an interpolation, where Vue decodes entities and `}}` ends it. Printed code writes `}}`
// only in a string, where `}\}` reads the same.
const inInterpolation = (text: string) => text.replaceAll('&', '&amp;').replace(/}(?=})/g, '}\\');

// An attribute holds a literal in quotes, and code bound.
function attribute(name: string, arg: string, value: unknown): string {
  const snippet = snippetValue(arg, value);
  if (snippet.kind === 'code') {
    return `:${name}="${inAttribute(snippet.code, '"')}"`;
  }
  return printAttribute(name, snippet) ?? `${name}="${inAttribute(String(snippet.value), '"')}"`;
}

// The text an interpolation shows, or code as an interpolation of its own. A `{` it ends with is
// escaped, as the code after it may start an interpolation.
function text(name: string, value: unknown): string {
  return (
    interpolatedText(snippetValue(name, value))?.replace(/\{$/, '&#123;') ??
    interpolation(name, value)
  );
}

const slot = (name: string, value: unknown) =>
  slotContent(snippetValue(name, value)) ?? interpolation(name, value);

const interpolation = (name: string, value: unknown) =>
  `{{ ${inInterpolation(code(name, value, "'"))} }}`;
