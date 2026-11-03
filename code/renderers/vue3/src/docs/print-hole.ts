import { type PrintHole, UnprintableArgError, printValue } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { isVNode } from 'vue';

import {
  type SnippetValue,
  attributeOrder,
  expressionCode,
  fitsBraces,
  interpolatedText,
  operand,
  printAttribute,
  slotContent,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template of the Vue story-docs provider, with the printers
// the static snippet is printed with:
//
// - `⟦attr arg name⟫…⟧`: the attribute `name`, left out while the arg is unset.
// - `⟦props * name…⟫⟧`: the args a control set, as an args binding passes them, but those it names.
// - `⟦text arg⟫…⟧`: the text of an interpolation, with `{<` and `{>` for a `{` the template writes
//   before or after it; with `slot`, a slot's content.
// - `⟦value arg⟫…⟧`: code in a template expression, in an attribute quoted with `'` (a `'` word) or
//   `"`, or in an interpolation (`{{`); with `script`, in `<script setup>`. A `.` word says the
//   code reads on after it, as `(5).toFixed()` does.
// - `⟦guard arg⟫⟧`: an arg the snippet has no place for, such as a slot the story leaves unset.
export const printHole: PrintHole = ({ kind, arg = '', words }, value) => {
  switch (kind) {
    case 'attr':
      return value === undefined ? '' : attribute(arg, words[0]!, value);
    case 'props':
      return Object.entries(value as Args)
        .filter(([name]) => !words.includes(name))
        .sort(([a], [b]) => attributeOrder(a, b))
        .map(([name, item]) => attribute(name, name, item))
        .join(' ');
    case 'text':
      return text(arg, value, words);
    case 'value': {
      const printed = words.includes('script')
        ? code(arg, value, "'")
        : expression(arg, value, words);
      return operand(printed, words.includes('.'));
    }
    case 'guard':
      throw new UnprintableArgError(arg);
    default:
      throw new Error(`Unknown hole ⟦${kind}⟧`);
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

// An attribute holds code in `"`, and a string without `&` in the quotes it does not hold.
function attribute(arg: string, name: string, value: unknown): string {
  const snippet = snippetValue(arg, value);
  const printed =
    snippet.kind === 'code' && expressionCode(snippet.code, '"') === undefined
      ? undefined
      : printAttribute(name, snippet);
  if (printed === undefined) {
    throw new UnprintableArgError(arg);
  }
  return printed;
}

function text(name: string, value: unknown, words: string[]): string {
  if (value === undefined) {
    return '';
  }
  const printed = snippetValue(name, value);
  const content = words.includes('slot') ? slotContent(printed) : interpolatedText(printed);
  if (content === undefined || !fitsBraces(content, words)) {
    throw new UnprintableArgError(name);
  }
  return content;
}

// Code in a template expression, with strings in the quote the attribute is not.
function expression(name: string, value: unknown, words: string[]): string {
  const quote = words.includes("'") ? "'" : words.includes('{{') ? undefined : '"';
  const printed = expressionCode(code(name, value, quote === "'" ? '"' : "'"), quote);
  if (printed === undefined) {
    throw new UnprintableArgError(name);
  }
  return printed;
}
