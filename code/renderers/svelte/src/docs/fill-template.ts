import {
  type FillSnippetTemplate,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  writtenCode,
} from 'storybook/internal/docs-tools';
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

// Fills a template of the Svelte story-docs provider (`printTemplate` in
// `docgen/story-docs/print-template.ts`) with the printers it prints the static snippet with. Kinds:
// `spread`, `spreadattr` (an attribute a later spread writes over), `attrvalue`, `quoted` and
// `fragment` (a read that prints a string as text), `code` and `value` (a read in code). Words:
// `p` parentheses, `'` single quotes, `<code` and `>code` around the value, `=name` the attribute,
// `?code` the code while the arg is unset; in a spread `-name`, `'name` and the layout words `<`,
// `|`, `>`.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => fill(kind, words, args));

function fill(kind: string, words: string[], args: Args): string {
  if (kind === 'spread') {
    return spread(args, words);
  }
  const [arg = '', ...flags] = words;
  const word = (prefix: string) => decoded(flags, prefix)[0];
  const unset = defaultCode(flags.find((flag) => flag.startsWith('?')));
  const quote = flags.includes("'") ? "'" : '"';
  // An action Storybook adds is no value of the story's, so it fills as an unset arg.
  const isSet = Object.hasOwn(args, arg) && !isAction(args[arg]);
  if (kind === 'spreadattr') {
    return isSet ? printSpreadAttribute(arg, propValue(arg, args[arg], quote)) : (unset ?? '');
  }
  if (unset !== undefined && !isSet) {
    return unset;
  }
  const value = isSet ? args[arg] : undefined;
  const code = () =>
    (word('<') ?? '') + read(arg, value, flags.includes('p'), quote) + (word('>') ?? '');
  const text = typeof value === 'string' ? readText(value) : undefined;
  switch (kind) {
    case 'attrvalue':
      return attributeText(word('=') ?? arg, text) ?? code();
    case 'quoted':
      return quotedText(text) ?? code();
    case 'fragment':
      return fragmentText(text) ?? code();
    default:
      return code();
  }
}

const decoded = (words: string[], prefix: string) =>
  words
    .filter((word) => word.startsWith(prefix))
    .map((word) => decodeURIComponent(word.slice(prefix.length)));

function spread(args: Args, words: string[]): string {
  const written = new Set(decoded(words, '-'));
  const quoted = new Set(decoded(words, "'"));
  const props = Object.entries(args).flatMap(([name, value]) => {
    const printed = written.has(name)
      ? undefined
      : propValue(name, value, quoted.has(name) ? "'" : '"');
    return printed === undefined ? [] : [printProp(name, printed)];
  });
  const [before = '', separator = ' ', after = ''] = ['<', '|', '>'].map(
    (prefix) => decoded(words, prefix)[0]
  );
  return props.length
    ? before + props.join(separator) + after
    : (defaultCode(words.find((word) => word.startsWith('?'))) ?? '');
}

// An arg as a spread prints it, from its value: left out while unset or an action.
function propValue(name: string, value: unknown, quote: '"' | "'"): PropValue {
  if (value === undefined || isAction(value)) {
    return undefined;
  }
  if (value === true) {
    return true;
  }
  return {
    ...(typeof value === 'string' ? { string: value } : {}),
    code: printValue(value, name, { quote }),
  };
}

// An arg read in code: the code the story writes it with, which needs parentheses where its `p`
// word says, or its value, which needs them where the code it prints as would.
function read(name: string, value: unknown, parentheses: boolean, quote: '"' | "'"): string {
  const needs = writtenCode(value) !== undefined ? parentheses : !isPrimary(...printedType(value));
  return printRead(printValue(value, name, { quote }), needs);
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
