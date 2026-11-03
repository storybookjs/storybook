import { type PrintHole, UnprintableArgError, printValue } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import {
  type PropValue,
  attributeText,
  fragmentText,
  isPrimary,
  printProp,
  printRead,
  printSpreadAttribute,
  quotedText,
  readText,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template from `printTemplate` in
// `docgen/story-docs/print-template.ts`, with the printers the static snippet is printed with:
//
// - `⟦prop arg⟫…⟧`: one prop a `{...args}` spread passes, left out while the arg is unset.
// - `⟦props * name…⟫⟧`: the args a control added, as a spread passes them, but those it names.
// - `⟦spreadattr arg⟫…⟧`: an attribute a later spread writes over.
// - `⟦value arg⟫…⟧` and `⟦property arg name⟫…⟧`: a read in code, and a shorthand property.
// - `⟦attrvalue arg name pre post⟫…⟧`, `⟦quoted arg pre post⟫…⟧`, `⟦fragment arg pre post⟫…⟧` and
//   `⟦code arg pre post⟫…⟧`: one whole read, which prints a string as text where next does, else
//   as code between `pre` and `post`.
// - `⟦member arg⟫…⟧`: a read of a member of an arg, which the snippet cannot follow.
export const printHole: PrintHole = ({ kind, arg = '', words }, value) => {
  const read = () => printRead(printValue(value, arg), !isPrimary(...printedType(value)));
  const text = typeof value === 'string' ? readText(value) : undefined;
  // The code a whole read is printed between, where it prints as code.
  const between = (before = '', after = '') => `${before}${read()}${after}`;
  switch (kind) {
    case 'prop':
      return printProp(arg, propValue(value, arg));
    case 'props':
      return Object.entries(value as Args)
        .filter(([name]) => !words.includes(name))
        .map(([name, item]) => printProp(name, propValue(item, name)))
        .filter(Boolean)
        .join(' ');
    case 'spreadattr':
      return printSpreadAttribute(arg, propValue(value, arg));
    case 'value':
      return read();
    case 'property':
      return `${words[0]}: ${read()}`;
    case 'attrvalue':
      return attributeText(words[0]!, text) ?? between(words[1], words[2]);
    case 'quoted':
      return quotedText(text) ?? between(...words);
    case 'fragment':
      return fragmentText(text) ?? between(...words);
    case 'code':
      return between(...words);
    case 'member':
      throw new UnprintableArgError(arg);
    default:
      throw new Error(`Unknown hole ⟦${kind}⟧`);
  }
};

// An arg as a spread prints it: left out while unset.
function propValue(value: unknown, name: string): PropValue {
  if (value === undefined) {
    return undefined;
  }
  if (value === true) {
    return true;
  }
  return {
    ...(typeof value === 'string' ? { string: value } : {}),
    code: printValue(value, name),
  };
}

// The node type of the code `printValue` prints for a value, and whether it is a negative number.
function printedType(value: unknown): [string, boolean] {
  if (typeof value === 'number') {
    return Number.isNaN(value) || value === Infinity
      ? ['Identifier', false]
      : ['Literal', value < 0];
  }
  if (value === undefined) {
    return ['Identifier', false];
  }
  if (Array.isArray(value)) {
    return ['ArrayExpression', false];
  }
  return typeof value === 'object' && value !== null
    ? ['ObjectExpression', false]
    : ['Literal', false];
}
