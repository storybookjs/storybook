import {
  type FillSnippetTemplate,
  UnprintableArgError,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  writtenCode,
} from 'storybook/internal/docs-tools';

/**
 * Fills a template of the Svelte story-docs provider, whose holes stand where its printer writes an
 * arg's value (see `printTemplate` in `docgen/story-docs/print-template.ts`), printing each value
 * as that printer does:
 *
 * - `⟦spread …⟧`: a `{...args}` spread, the args as attributes, but those its `-name` words name.
 * - `⟦spreadattr name⟧`: an attribute a later `{...args}` spread writes over with the arg.
 * - `⟦attrvalue arg …⟧`, `⟦quoted arg …⟧`, `⟦fragment arg …⟧`: an `{args.x}` attribute value,
 *   part of a quoted attribute value or text, which prints a plain string as text.
 * - `⟦code arg …⟧`, `⟦value arg …⟧`: an arg read in code.
 *
 * Words: `p` when the code the story writes the arg with needs parentheses, `'` (or `'name` in a
 * spread) when the story quotes a string with `'`, `<code` and `>code` for the code around the
 * value, `=name` for the attribute name, `line` when a spread is alone on its line, and a `?code`
 * default for an arg that is unset, which next leaves as the story writes it.
 */
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    if (kind === 'spread') {
      return spread(args, words);
    }
    const [arg = '', ...flags] = words;
    const word = (prefix: string) => {
      const found = flags.find((flag) => flag.startsWith(prefix));
      return found === undefined ? undefined : decodeURIComponent(found.slice(prefix.length));
    };
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
      return prop(arg, value, quote) || `${arg}={undefined}`;
    }
    const pre = word('<') ?? '';
    const post = word('>') ?? '';
    const code = () => pre + read(arg, value, flags.includes('p'), quote) + post;
    const text = typeof value === 'string' && value.trim() ? value : undefined;
    switch (kind) {
      case 'attrvalue':
        return text !== undefined && isPlain(text) ? `${word('=')}="${text}"` : code();
      case 'quoted':
        return text !== undefined && !/[{}]/.test(text) ? escapeAttribute(text) : code();
      case 'fragment':
        return text !== undefined && !/[{}<>"\\&]/.test(text) ? text : code();
      default:
        return code();
    }
  });

// A `{...args}` spread: one attribute per arg, on one line or one per line past 50 characters, with
// the whitespace before it taken along as next's printer takes it.
function spread(args: Record<string, unknown>, words: string[]): string {
  const decoded = (prefix: string) =>
    words
      .filter((word) => word.startsWith(prefix))
      .map((word) => decodeURIComponent(word.slice(prefix.length)));
  const written = new Set(decoded('-'));
  const quoted = new Set(decoded("'").filter(Boolean));
  const [pre = ''] = decoded('<');
  const [post = ''] = decoded('>');
  const props = Object.entries(args).flatMap(([name, value]) => {
    if (written.has(name)) {
      return [];
    }
    const printed = prop(name, value, quoted.has(name) ? "'" : '"');
    return printed ? [printed] : [];
  });
  const value = props.join(' ').length > 50 ? `\n  ${props.join('\n  ')}\n` : props.join(' ');
  if (!value) {
    if (words.includes('line')) {
      return '';
    }
    return (pre.endsWith(' ') ? pre.slice(0, -1) : pre) + post;
  }
  return (value.startsWith('\n') ? pre.replace(/[ \t]+$/, '') : pre) + value + post;
}

// One attribute as next prints a spread arg: left out while unset, the name alone for `true`, a
// plain string quoted, anything else as code.
function prop(name: string, value: unknown, quote: '"' | "'"): string {
  if (value === undefined || isAction(value)) {
    return '';
  }
  if (!/^[A-Za-z_$][\w:$-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
  if (value === true) {
    return name;
  }
  return typeof value === 'string' && isPlain(value)
    ? `${name}="${value}"`
    : `${name}={${printValue(value, name, { quote })}}`;
}

// An arg read in code: the code the story writes it with, or its value, in parentheses where a
// read stood unless it keeps its meaning there without them.
function read(name: string, value: unknown, parens: boolean, quote: '"' | "'"): string {
  const printed = printValue(value, name, { quote });
  const needs =
    writtenCode(value) !== undefined
      ? parens
      : (typeof value === 'number' && !(value >= 0)) ||
        (typeof value === 'object' && value !== null && !Array.isArray(value));
  return needs ? `(${printed})` : printed;
}

// A string that reads the same in a quoted attribute as in an expression.
const isPlain = (value: string) => !/[{}<>"\\&\r\n\t]/.test(value);

const escapeAttribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
