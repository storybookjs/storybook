import type { Args } from 'storybook/internal/types';

/**
 * Fills a story-docs `template` with the current args, so the story's snippet follows the controls.
 *
 * A template is the story's code with a hole, `⟦kind word…⟧`, wherever it reads an arg. The
 * story-docs provider writes the holes, as it knows what each arg reference is, and the renderer's
 * filler prints each one with the current args:
 *
 * - `⟦props …⟧`: the args a spread passes, as attributes; each renderer documents its words.
 * - `⟦attr name arg⟧`: one attribute, left out while the arg is unset.
 * - `⟦text arg⟧`: the arg as content.
 * - `⟦value arg⟧`: the arg as a literal in code.
 * - `⟦operand arg⟧`: a value the code reads on, as in `args.n.toFixed()` or `-args.n`; see
 *   {@link asOperand}.
 *
 * The template keeps the code around a hole as written, including the whitespace before it; a hole that prints
 * nothing takes that whitespace along, so an unset attribute leaves no gap or empty line. A
 * renderer sets its filler as `parameters.docs.source.fillTemplate`. It throws an
 * {@link UnprintableArgError} for a value the snippet cannot show, and the static snippet is shown
 * instead.
 */
export type FillSnippetTemplate = (template: string, args: Args) => string;

/** Thrown by a {@link FillSnippetTemplate} for an arg whose value the snippet cannot show. */
export class UnprintableArgError extends Error {
  override readonly name = 'UnprintableArgError';

  constructor(readonly argName: string) {
    super(`The snippet cannot show the value of the \`${argName}\` arg.`);
  }
}

/** A template hole; a word holds no space and no bracket. */
export const hole = (kind: string, ...words: string[]) => `⟦${[kind, ...words].join(' ')}⟧`;

/** Whether `word`, such as an arg name, can be written in a hole. */
export const isHoleWord = (word: string) => /^[^\s⟦⟧]+$/.test(word);

/** Whether code already holds a hole bracket, so holes written in it could not be found again. */
export const hasHoleBracket = (code: string) => /[⟦⟧]/.test(code);

/** Replaces every hole in a template with what `fill` prints for it; see {@link FillSnippetTemplate}. */
export const fillHoles = (template: string, fill: (kind: string, words: string[]) => string) =>
  template.replace(/(\s*)⟦([^⟧]*)⟧/g, (_, space: string, body: string) => {
    const [kind, ...words] = body.split(' ');
    const printed = fill(kind!, words);
    return printed && space + printed;
  });

/**
 * A printed literal in parentheses where code reading on would read it differently, as `5.x`,
 * `--1`, `{ a: 1 }` as an arrow body or `() => {}()`.
 */
export const asOperand = (printed: string) => (/^[-\d{(]/.test(printed) ? `(${printed})` : printed);

/**
 * The args a `⟦props …⟧` spread passes: every arg but those its `-name` words name, which the
 * element writes after the spread. A `^name` word is written before it, where a set arg would win
 * over what the snippet shows, so the snippet cannot show that arg.
 */
export function spreadArgs(args: Args, words: string[]): [string, unknown][] {
  for (const word of words) {
    if (word.startsWith('^') && args[word.slice(1)] !== undefined) {
      throw new UnprintableArgError(word.slice(1));
    }
  }
  const written = new Set(words.map((word) => word.slice(1)));
  return Object.entries(args).filter(([name]) => !written.has(name));
}

/**
 * Code cut from a story file, without the indentation its lines after the first share there, as
 * the first starts where the cut does.
 */
export function dedentStoryCode(text: string): string {
  const [first, ...rest] = text.split('\n');
  const indents = rest.filter((line) => line.trim()).map((line) => /^\s*/.exec(line)![0].length);
  const indent = Math.min(...indents);
  return [first, ...rest.map((line) => line.slice(indent))].join('\n');
}

/**
 * Prints an arg value as the JavaScript literal it would be written as. A value with no literal,
 * such as a function, a class instance, a cycle or anything `opaque` matches at any depth, throws
 * an {@link UnprintableArgError} for `name`, and so does a literal too long to read in a snippet.
 */
export function printValue(
  value: unknown,
  name: string,
  { quote = '"', opaque }: { quote?: '"' | "'"; opaque?: (value: unknown) => boolean } = {}
): string {
  const parents = new Set<unknown>();
  const print = (item: unknown): string => {
    if (opaque?.(item) || parents.has(item)) {
      throw new UnprintableArgError(name);
    }
    if (typeof item === 'string') {
      const escaped = item
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
        .replaceAll(quote, `\\${quote}`);
      return `${quote}${escaped}${quote}`;
    }
    if (item === null || ['undefined', 'number', 'boolean'].includes(typeof item)) {
      return String(item);
    }
    if (!Array.isArray(item) && !isPlainObject(item)) {
      throw new UnprintableArgError(name);
    }
    parents.add(item);
    const printed = Array.isArray(item)
      ? `[${item.map(print).join(', ')}]`
      : printObject(
          Object.entries(item).filter(([, entry]) => entry !== undefined),
          print
        );
    parents.delete(item);
    return printed;
  };
  const printed = print(value);
  if (printed.length > MAX_LITERAL_LENGTH) {
    throw new UnprintableArgError(name);
  }
  return printed;
}

// Longer data, such as a GeoJSON file, would bury the rest of the snippet.
const MAX_LITERAL_LENGTH = 2000;

const printObject = (entries: [string, unknown][], print: (item: unknown) => string) =>
  entries.length === 0
    ? '{}'
    : `{ ${entries
        .map(
          ([key, entry]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : print(key)}: ${print(entry)}`
        )
        .join(', ')} }`;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
