import { type PrintHole, printValue } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import {
  type JsxValue,
  printArgsEntry,
  printArgsObject,
  printAttribute,
  printAttributes,
  printChildren,
  printClose,
} from '../snippet-values.ts';

// Prints a changed arg for a hole of a template from `getCodeSnippet`, with the printers the static
// snippet is printed with:
//
// - `⟦attr arg name⟫…⟧`: the attribute `name`, left out while the arg is unset.
// - `⟦text arg⟫…⟧`: the arg as content.
// - `⟦close children Button⟫…⟧`: the end of the element, with the `children` arg as content.
// - `⟦value arg⟫…⟧`: the arg as an expression.
// - `⟦attrs * name…⟫⟧`: the args a control added, as attributes, but those its words name.
// - `⟦entries *⟫⟧` and `⟦object *⟫{}⟧`: the args a control added to the args of a bound story.
export const printHole: PrintHole = ({ kind, arg = '', words }, value) => {
  switch (kind) {
    case 'attr':
      return value === undefined ? '' : printAttribute(words[0]!, describe(arg, value));
    case 'text':
      return value === undefined ? '' : printChildren(describe(arg, value));
    case 'close':
      return value === undefined
        ? ' />'
        : printClose(words[0]!, printChildren(describe(arg, value)));
    case 'value':
      return printValue(value, arg);
    case 'attrs': {
      const added = Object.entries(value as Args).filter(([name]) => !words.includes(name));
      const attributes = printAttributes(added.map(([name, item]) => [name, describe(name, item)]));
      return attributes.map((attribute) => ` ${attribute}`).join('');
    }
    case 'entries':
      return codes(value as Args)
        .map((entry) => `,\n${printArgsEntry(entry)}`)
        .join('');
    case 'object':
      return printArgsObject(codes(value as Args));
    default:
      throw new Error(`Unknown hole ⟦${kind}⟧`);
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
