import { type PrintHole, printValue, unknownHoleKind } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { isVNode } from 'vue';

import {
  type SnippetValue,
  type VueHolePlace,
  attributeOrder,
  inAttribute,
  inInterpolation,
  indent,
  operand,
  printAttribute,
  printSlot,
  printText,
  slotOrder,
  wrapSlotContent,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template of the Vue story-docs provider, with the printers
// the static snippet is printed with. `VueHolePlace` says what each place prints.
export const printHole: PrintHole<VueHolePlace> = (hole, value) => {
  const arg = hole.arg ?? '';
  switch (hole.kind) {
    case 'attr':
      return value === undefined ? '' : printAttribute(hole.name ?? arg, snippetValue(arg, value));
    case 'props':
      return Object.entries(value as Args)
        .filter(([name, item]) => item !== undefined && !hole.except.includes(name))
        .sort(([a], [b]) => attributeOrder(a, b))
        .map(([name, item]) => printAttribute(name, snippetValue(name, item)))
        .join(' ');
    case 'slots': {
      const set = hole.slots.filter((name) => (value as Args)[name] !== undefined).sort(slotOrder);
      if (set.length === 0) {
        return hole.tag ? ' />' : '';
      }
      const children = set
        .map((name) => wrapSlotContent(name, printSlot(snippetValue(name, (value as Args)[name]))))
        .map((child) => indent(child, hole.indent))
        .join('\n');
      return hole.tag ? `>\n${children}\n${hole.indent.slice(2)}</${hole.tag}>` : `\n${children}`;
    }
    case 'text':
      return value === undefined
        ? ''
        : (hole.slot ? printSlot : printText)(snippetValue(arg, value));
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
