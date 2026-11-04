import { type PrintHole, UnprintableArgError, printValue } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { isVNode } from 'vue';

import {
  type SnippetValue,
  type VueHolePlace,
  attributeOrder,
  expressionCode,
  fitsBraces,
  interpolatedText,
  operand,
  printAttribute,
  slotContent,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template of the Vue story-docs provider, with the printers
// the static snippet is printed with. `VueHolePlace` says what each place prints.
export const printHole: PrintHole<VueHolePlace> = (hole, value) => {
  const { place } = hole;
  const arg = hole.arg ?? '';
  switch (place.kind) {
    case 'attr':
      return value === undefined ? '' : attribute(arg, place.name, value);
    case 'props':
      return Object.entries(value as Args)
        .filter(([name]) => !place.except.includes(name))
        .sort(([a], [b]) => attributeOrder(a, b))
        .map(([name, item]) => attribute(name, name, item))
        .join(' ');
    case 'text':
      return text(arg, value, place);
    case 'value': {
      const printed =
        place.in === 'script'
          ? code(arg, value, "'")
          : expression(arg, value, place.in === 'attribute' ? place.quote : undefined);
      return operand(printed, place.readsOn === true);
    }
    case 'guard':
      throw new UnprintableArgError(arg);
    default:
      throw new Error(`Unknown hole ⟦${(place as { kind: string }).kind}⟧`);
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

function text(
  name: string,
  value: unknown,
  place: Extract<VueHolePlace, { kind: 'text' }>
): string {
  if (value === undefined) {
    return '';
  }
  const printed = snippetValue(name, value);
  const content = place.slot ? slotContent(printed) : interpolatedText(printed);
  if (content === undefined || !fitsBraces(content, place)) {
    throw new UnprintableArgError(name);
  }
  return content;
}

// Code in a template expression, with strings in the quote the attribute is not, or in an
// interpolation without one.
function expression(name: string, value: unknown, quote: '"' | "'" | undefined): string {
  const printed = expressionCode(code(name, value, quote === "'" ? '"' : "'"), quote);
  if (printed === undefined) {
    throw new UnprintableArgError(name);
  }
  return printed;
}
