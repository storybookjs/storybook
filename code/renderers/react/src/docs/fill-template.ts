import {
  type FillSnippetTemplate,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
  writtenCode,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import {
  type JsxValue,
  printArgsObject,
  printAttribute,
  printAttributes,
  printChildren,
  printClose,
  printElement,
} from '../snippet-values.ts';

// Fills a template from `getCodeSnippet`, printing each hole with the printers the static snippet
// is printed with, so the template filled with the story's own args is its static snippet:
//
// - `⟦element Button⟧`: the component with every arg, `children` as content.
// - `⟦props⟧`: the args a spread passes, as attributes.
// - `⟦args⟧`: the args of a bound story, as an object.
// - `⟦attr name arg⟧`: one attribute, left out while the arg is unset.
// - `⟦text children⟧`: the `children` arg as content.
// - `⟦close Button⟧`: the end of an element a spread passes `children` to, with them as content.
//
// A `-name` word names an arg the element writes itself, which a spread leaves out. A `=name=code`
// word is the code a written arg prints in this place, where it is not its `argCode`, such as a
// value over several lines indented as the place is. A `"name=text` word is a written string this
// place prints as that text, which another place prints as code. `jsx` says the written `children`
// arg is JSX, which content prints as it is. A last `?code` word is the code the hole prints while
// its arg is unset.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => fill(kind, words, args));

function fill(kind: string, words: string[], args: Args): string {
  const [first = '', second = ''] = words;
  // Only an arg's own value: a name every object inherits, such as `constructor`, is no arg.
  const arg = (name: string) => (Object.hasOwn(args, name) ? args[name] : undefined);
  const value = (name: string) => describe(name, arg(name), words);
  const unset = (name: string) => (arg(name) === undefined ? defaultCode(words.at(-1)) : undefined);
  const spread = () =>
    spreadArgs(
      args,
      words.filter((word) => word.startsWith('-'))
    ).filter(([, passed]) => passed !== undefined && !isAction(passed));
  switch (kind) {
    case 'element': {
      const passed = spread();
      const children = passed.find(([name]) => name === 'children');
      return printElement(
        first,
        printAttributes(
          passed.filter(([name]) => name !== 'children').map(([name]) => [name, value(name)])
        ),
        children ? printChildren(value('children')) : ''
      );
    }
    case 'close':
      return arg('children') === undefined
        ? (defaultCode(words.at(-1)) ?? ' />')
        : printClose(first, printChildren(value('children')));
    case 'props':
      return printAttributes(spread().map(([name]) => [name, value(name)])).join(' ');
    case 'args':
      return printArgsObject(spread().map(([name]) => [name, value(name)]));
    case 'attr':
      return (
        unset(second) ??
        (arg(second) === undefined || isAction(arg(second))
          ? ''
          : printAttribute(first, value(second)))
      );
    case 'text':
      return unset(first) ?? (arg(first) === undefined ? '' : printChildren(value(first)));
    default:
      throw new Error(`Unknown hole ⟦${kind}⟧`);
  }
}

// A current arg as the printers read it: a written arg as the code it prints in this place, and a
// changed one as its value.
function describe(name: string, value: unknown, words: string[]): JsxValue {
  const written = writtenCode(value);
  const text = words.find((word) => word.startsWith(`"${encodeURIComponent(name)}=`));
  if (written !== undefined && text !== undefined) {
    return {
      kind: 'string',
      value: text.slice(encodeURIComponent(name).length + 2),
      code: written,
    };
  }
  if (written !== undefined) {
    const prefix = `=${encodeURIComponent(name)}=`;
    const here = words.find((word) => word.startsWith(prefix))?.slice(prefix.length);
    return {
      kind: name === 'children' && words.includes('jsx') ? 'jsx' : 'code',
      code: here ?? written,
    };
  }
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value };
  }
  return typeof value === 'string'
    ? { kind: 'string', value, code: printValue(value, name) }
    : { kind: 'code', code: printValue(value, name) };
}
