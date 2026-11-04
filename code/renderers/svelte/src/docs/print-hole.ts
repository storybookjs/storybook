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
  printProp,
  printSpreadAttribute,
  printWholeRead,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template from `printTemplate` in
// `docgen/story-docs/print-template.ts`, with the printers the static snippet is printed with; see
// `SvelteHolePlace` for what each place is.
export const printHole: PrintHole<SvelteHolePlace> = (hole, value) => {
  const arg = hole.arg ?? '';
  const read = () => {
    const code = printValue(value, arg);
    // As in `-args.n` or `() => args.o`, a negative number or an object literal needs parentheses.
    const object = typeof value === 'object' && value !== null && !Array.isArray(value);
    return object || (typeof value === 'number' && value < 0) ? `(${code})` : code;
  };
  switch (hole.kind) {
    case 'prop':
      return printProp(arg, propValue(value, arg));
    case 'props':
      return Object.entries(value as Args)
        .filter(([name]) => !hole.except.includes(name))
        .map(([name, item]) => printProp(name, propValue(item, name)))
        .filter(Boolean)
        .join(' ');
    case 'spreadattr':
      return printSpreadAttribute(arg, propValue(value, arg));
    case 'value':
      return read();
    case 'property':
      return `${hole.name ?? arg}: ${read()}`;
    case 'attrvalue':
    case 'quoted':
    case 'fragment':
    case 'code':
      return printWholeRead(hole, arg, read(), typeof value === 'string' ? value : undefined);
    case 'member':
      throw new UnprintableArgError(arg);
    default:
      return unknownHoleKind(hole);
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
