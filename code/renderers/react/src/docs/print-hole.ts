import {
  type PrintHole,
  printValue,
  unknownHoleKind,
} from 'storybook/internal/docs-tools/snippets';
import type { Args } from 'storybook/internal/types';

import {
  type JsxValue,
  type ReactHolePlace,
  printAttribute,
  printAttributes,
  printChildren,
} from '../snippet-values.ts';

// Fills a hole of a template from `getCodeSnippet` with an arg a control changed, printed as the
// static snippet prints a value there; see `ReactHolePlace`.
export const printHole: PrintHole<ReactHolePlace> = (hole, value) => {
  const arg = hole.arg ?? '';
  switch (hole.kind) {
    case 'attr':
      return value === undefined ? '' : printAttribute(hole.name ?? arg, toJsxValue(arg, value));
    case 'text':
      return value === undefined ? '' : printChildren(toJsxValue(arg, value));
    case 'value':
      return printValue(value, arg);
    case 'attrs':
      return printAttributes(
        Object.entries(value as Args)
          .filter(([name]) => !hole.except.includes(name))
          .map(([name, item]) => [name, toJsxValue(name, item)])
      )
        .map((attribute) => ` ${attribute}`)
        .join('');
    default:
      return unknownHoleKind(hole);
  }
};

const toJsxValue = (name: string, value: unknown): JsxValue => {
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value };
  }
  return typeof value === 'string'
    ? { kind: 'string', value, code: printValue(value, name) }
    : { kind: 'code', code: printValue(value, name) };
};
