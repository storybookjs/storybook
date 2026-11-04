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
  printAccessors,
  printProp,
  printSpreadAttribute,
  printWholeRead,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template from `printTemplate` in
// `docgen/story-docs/print-template.ts`, with the printers the static snippet is printed with; see
// `SvelteHolePlace` for what each place is.
export const printHole: PrintHole<SvelteHolePlace> = (hole, value) => {
  const arg = hole.arg ?? '';
  switch (hole.kind) {
    case 'prop':
      return printProp(arg, propValue(value, arg));
    case 'props':
      return Object.entries(value as Args)
        .filter(([name]) => !hole.except.includes(name))
        .map(([name, item]) => printProp(name, propValue(item, name)))
        .join(hole.separator);
    case 'spreadattr':
      return printSpreadAttribute(arg, propValue(value, arg));
    case 'overridden': {
      const args = value as Args;
      if (Object.hasOwn(args, hole.name)) {
        return printSpreadAttribute(hole.name, propValue(args[hole.name], hole.name));
      }
      return Object.hasOwn(args, hole.read.arg)
        ? printHole(hole.read, args[hole.read.arg])
        : hole.written;
    }
    case 'cleared':
      if (value === undefined) {
        throw new UnprintableArgError(arg);
      }
      return '';
    case 'overwritten':
      // The attribute would follow both this arg and the args it reads, but a hole reads one arg.
      throw new UnprintableArgError(arg);
    case 'value':
      return printRead(value, arg, hole.path).code;
    case 'property':
      return `${hole.name ?? arg}: ${printRead(value, arg).code}`;
    case 'attrvalue':
    case 'quoted':
    case 'fragment':
    case 'code': {
      const { code, string } = printRead(value, arg, hole.path);
      return printWholeRead(hole, arg, code, string);
    }
    default:
      return unknownHoleKind(hole);
  }
};

// A read of an arg, or of the member `path` of it, as the snippet prints one of an arg the story
// writes as an object literal: a member of an object prints as the value it holds, any other keeps
// its accessors. `string` is the string the read prints, if any.
function printRead(
  value: unknown,
  arg: string,
  path: string[] = []
): { code: string; string?: string } {
  let rest = path;
  while (rest.length && isObject(value) && Object.hasOwn(value, rest[0])) {
    value = value[rest[0]];
    rest = rest.slice(1);
  }
  const code = printValue(value, arg);
  // As in `-args.n`, `() => args.o` or `args.o.a`, a negative number or an object needs parentheses,
  // and as in `args.n.toFixed(2)`, any number before an accessor.
  const number = typeof value === 'number' && (value < 0 || rest.length > 0);
  const wrapped = isObject(value) || number ? `(${code})` : code;
  return rest.length
    ? { code: `${wrapped}${printAccessors(rest)}` }
    : { code: wrapped, ...(typeof value === 'string' && { string: value }) };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
