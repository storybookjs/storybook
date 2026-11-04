import { type PrintHole, printValue, unknownHoleKind } from 'storybook/internal/docs-tools';
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
export const printHole: PrintHole<ReactHolePlace> = (hole, value) => {
  const arg = hole.arg ?? '';
  switch (hole.kind) {
    case 'attr':
      return value === undefined ? '' : printAttribute(hole.name ?? arg, toJsxValue(arg, value));
    case 'text':
      return value === undefined ? '' : printChildren(toJsxValue(arg, value));
    case 'close':
      return value === undefined
        ? ' />'
        : printClose(hole.element, printChildren(toJsxValue(arg, value)));
    case 'value':
      return printValue(value, arg);
    case 'attrs': {
      const added = Object.entries(value as Args).filter(([name]) => !hole.except.includes(name));
      const attributes = printAttributes(
        added.map(([name, item]) => [name, toJsxValue(name, item)])
      );
      return attributes.map((attribute) => ` ${attribute}`).join('');
    }
    case 'entries':
      return codes(value as Args, hole.except)
        .map((entry) => `,\n${printArgsEntry(entry)}`)
        .join('');
    case 'object':
      return printArgsObject(codes(value as Args));
    case 'overridden': {
      const args = value as Args;
      const read = [hole.name, hole.reads].find((name) => Object.hasOwn(args, name));
      return read === undefined
        ? hole.written
        : printAttribute(hole.name, toJsxValue(read, args[read]));
    }
    default:
      return unknownHoleKind(hole);
  }
};

// Each arg as its code, but those named in `except`.
const codes = (args: Args, except: string[] = []) =>
  Object.entries(args)
    .filter(([name]) => !except.includes(name))
    .map(([name, value]): [string, string] => [name, printValue(value, name)]);

const toJsxValue = (name: string, value: unknown): JsxValue => {
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value };
  }
  return typeof value === 'string'
    ? { kind: 'string', value, code: printValue(value, name) }
    : { kind: 'code', code: printValue(value, name) };
};
