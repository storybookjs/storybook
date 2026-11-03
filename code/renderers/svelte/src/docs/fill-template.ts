import {
  type FillSnippetTemplate,
  UnprintableArgError,
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
  printProp,
  printRead,
  printSpreadAttribute,
  quotedText,
  readText,
} from '../snippet-values.ts';

/**
 * Fills a template of the Svelte story-docs provider, whose holes stand where its printer writes an
 * arg's value (see `printTemplate` in `docgen/story-docs/print-template.ts`), printing each value
 * with the printers it prints the static snippet with:
 *
 * - `⟦spread …⟧`: a `{...args}` spread, the args as attributes, but those its `-name` words name,
 *   joined by its `|` word, between its `<` and `>` words, or its `?code` word while it passes none.
 * - `⟦spreadattr name⟧`: an attribute a later `{...args}` spread writes over with the arg.
 * - `⟦attrvalue arg …⟧`, `⟦quoted arg …⟧`, `⟦fragment arg …⟧`: an `{args.x}` attribute value,
 *   part of a quoted attribute value or text, which prints a plain string as text.
 * - `⟦code arg …⟧`, `⟦value arg …⟧`: an arg read in code.
 *
 * Words: `p` when the code the story writes the arg with needs parentheses, `'` (or `'name` in a
 * spread) when the story quotes a string with `'`, `<code` and `>code` for the code around the
 * value, `=name` for the attribute name, and a `?code` default for an arg that is unset, which next
 * leaves as the story writes it.
 */
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
  if (unset !== undefined && !Object.hasOwn(args, arg)) {
    return unset;
  }
  const value = args[arg];
  if (kind === 'spreadattr') {
    if (!Object.hasOwn(args, arg) || isAction(value)) {
      return unset ?? '';
    }
    return printSpreadAttribute(arg, propValue(arg, value, quote));
  }
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
    if (printed === undefined) {
      return [];
    }
    if (!/^[A-Za-z_$][\w:$-]*$/.test(name)) {
      throw new UnprintableArgError(name);
    }
    return [printProp(name, printed)];
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
// word says, or its value, which needs them for a negative number or an object literal.
function read(name: string, value: unknown, parentheses: boolean, quote: '"' | "'"): string {
  const needs =
    writtenCode(value) !== undefined
      ? parentheses
      : (typeof value === 'number' && !(value >= 0)) ||
        (typeof value === 'object' && value !== null && !Array.isArray(value));
  return printRead(printValue(value, name, { quote }), needs);
}
