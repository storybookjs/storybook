import {
  type PrintHole,
  UnprintableArgError,
  printValue,
  unknownHoleKind,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import {
  type JsxValue,
  type ReactHolePlace,
  printArgsEntry,
  printArgsObject,
  printAttribute,
  printAttributes,
  printChildren,
  printClose,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template from `getCodeSnippet`, with the printers the static
// snippet is printed with; see `ReactHolePlace` for what each place prints.
export const printHole: PrintHole<ReactHolePlace> = ({ place, arg = '' }, value) => {
  switch (place.kind) {
    case 'attr':
      return value === undefined ? '' : printAttribute(place.name, describe(arg, value));
    case 'text':
      return value === undefined ? '' : printChildren(describe(arg, value));
    case 'close':
      return value === undefined
        ? ' />'
        : printClose(place.element, printChildren(describe(arg, value)));
    case 'value':
      return printValue(value, arg);
    case 'attrs': {
      const added = Object.entries(value as Args).filter(([name]) => !place.except.includes(name));
      const attributes = printAttributes(added.map(([name, item]) => [name, describe(name, item)]));
      return attributes.map((attribute) => ` ${attribute}`).join('');
    }
    case 'entries':
      return codes(value as Args)
        .filter(([name]) => !place.except.includes(name))
        .map((entry) => `,\n${printArgsEntry(entry)}`)
        .join('');
    case 'object':
      return printArgsObject(codes(value as Args));
    case 'guard':
      throw new UnprintableArgError(arg);
    default:
      return unknownHoleKind(place);
  }
};

const codes = (args: Args) =>
  Object.entries(args).map(([name, value]): [string, string] => [name, printValue(value, name)]);

const describe = (name: string, value: unknown): JsxValue => {
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value };
  }
  return typeof value === 'string'
    ? { kind: 'string', value, code: printValue(value, name) }
    : { kind: 'code', code: printValue(value, name) };
};
