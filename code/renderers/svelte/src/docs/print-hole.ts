import {
  type PrintHole,
  UnprintableArgError,
  printValue,
  unknownHoleKind,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import {
  type PropValue,
  type SvelteHolePlace,
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
// `docgen/story-docs/print-template.ts`, with the printers the static snippet is printed with; see
// `SvelteHolePlace` for what each place is.
export const printHole: PrintHole<SvelteHolePlace> = (hole, value) => {
  const { place } = hole;
  const arg = hole.arg ?? '';
  const read = () => printRead(printValue(value, arg), !isPrimary(...printedType(value)));
  const text = typeof value === 'string' ? readText(value) : undefined;
  // A whole read where it prints as code, between the code its place writes around it.
  const between = ({ before, after }: { before: string; after: string }) =>
    `${before}${read()}${after}`;
  switch (place.kind) {
    case 'prop':
      return printProp(arg, propValue(value, arg));
    case 'props':
      return Object.entries(value as Args)
        .filter(([name]) => !place.except.includes(name))
        .map(([name, item]) => printProp(name, propValue(item, name)))
        .filter(Boolean)
        .join(' ');
    case 'spreadattr':
      return printSpreadAttribute(arg, propValue(value, arg));
    case 'value':
      return read();
    case 'property':
      return `${place.name}: ${read()}`;
    case 'attrvalue':
      return attributeText(place.name, text) ?? between(place);
    case 'quoted':
      return quotedText(text) ?? between(place);
    case 'fragment':
      return fragmentText(text) ?? between(place);
    case 'code':
      return between(place);
    case 'member':
      throw new UnprintableArgError(arg);
    default:
      return unknownHoleKind(place);
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
