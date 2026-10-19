import type { Args } from 'storybook/internal/types';

/**
 * Fills a story-docs `template` with the current args, so the story's snippet follows the controls.
 *
 * A template is the story's code with a hole, `⟦kind word…⟧`, wherever it reads an arg. The
 * story-docs provider writes the holes, as it knows what each arg reference is, and the renderer's
 * filler prints each one with the current args:
 *
 * - `⟦props …⟧`: the args a spread passes, as attributes, but those its `-name` words name; see
 *   {@link spreadArgs}.
 * - `⟦attr name arg⟧`: one attribute, left out while the arg is unset.
 * - `⟦text arg⟧`: the arg as content.
 * - `⟦value arg⟧`: the arg as a literal in code.
 * - `⟦operand arg⟧`: a value the code reads on, as in `args.n.toFixed()`, that starts an arrow
 *   body or a statement, or code the story writes the arg with next to an operator, as in
 *   `!args.onClick`, in parentheses where it needs them; see `isOperand` and {@link asOperand}.
 *
 * Words are separated by one space. A word that starts with `%` is the rest of it URI-encoded, so
 * any arg name can be a word; see {@link holeWord}. A hole for one arg may end in a `?code` word,
 * the code it prints while the arg is unset, as a parameter default gives it; see
 * {@link defaultWord}.
 *
 * A renderer may add holes and words of its own, which the comment on its filler documents, such
 * as React's `⟦element Button⟧` or Vue's `⟦slots Card⟧`. Angular's `⟦props⟧` instead names the
 * inputs it binds, and an `=` word before them binds an arg set to `undefined` too.
 *
 * The template keeps the code around a hole as written, including the whitespace before it. An
 * attribute hole, `⟦props⟧`, `⟦attr⟧`, `⟦bool⟧` or `⟦prop⟧`, that prints nothing takes that
 * whitespace along, so an unset attribute leaves no gap or empty line. Any other hole keeps it, as
 * the story renders it, unless it holds a line break, where it would leave an empty line; the Web
 * Components `⟦style⟧`, `⟦quoted⟧` and `⟦raw⟧` are no attribute holes.
 *
 * An arg that still holds the value the story is written with comes as a {@link writtenArg}, the
 * code the story writes it with, which {@link printValue} prints as it is.
 *
 * A renderer sets its filler as `parameters.docs.source.fillTemplate`. It throws an
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

// A symbol shared across bundles: the preview runtime and a renderer may each bundle a copy of this
// module, so a class would fail `instanceof`.
const WRITTEN = Symbol.for('storybook/written-arg');

/**
 * An arg as `code`, the code the story writes it with, which {@link printValue} prints as it is.
 * The preview fills a template with it for an arg that still holds the value the story is written
 * with, so the filled snippet shows that arg as the static snippet does; see `StoryDoc.argCode`.
 */
export const writtenArg = (code: string): object => ({ [WRITTEN]: code });

/**
 * The args to fill a template with: each arg that still holds the value the story is written with
 * and has `argCode`, the code the story writes it with, as a {@link writtenArg} of that code, so
 * the snippet shows it as the story writes it; any other arg, such as one a control changed, as its
 * value.
 */
export const asWrittenArgs = (
  { args, unmappedArgs, initialArgs }: { args: Args; unmappedArgs: Args; initialArgs: Args },
  argCode: Record<string, string> = {}
): Args =>
  Object.fromEntries(
    Object.entries(args).map(([name, value]) => [
      name,
      Object.hasOwn(argCode, name) && unmappedArgs[name] === initialArgs[name]
        ? writtenArg(argCode[name]!)
        : value,
    ])
  );

/** The code a {@link writtenArg} holds, or `undefined` for any other value. */
const writtenCode = (value: unknown): string | undefined =>
  typeof value === 'object' && value !== null && WRITTEN in value
    ? (value[WRITTEN] as string)
    : undefined;

/**
 * Whether an arg is a spy from `fn()` or a handler from `action()`, which a filled snippet leaves
 * out. One the story writes comes as a {@link writtenArg} instead, so this is one Storybook adds,
 * as `argTypesRegex` does.
 */
export const isAction = (value: unknown) =>
  typeof value === 'function' && ('getMockName' in value || 'isAction' in value);

/** A template hole; each word is one {@link isHoleWord} or written with {@link holeWord}. */
export const hole = (kind: string, ...words: string[]) => `⟦${[kind, ...words].join(' ')}⟧`;

/** Whether `word`, such as an arg name, can be written in a hole as it is. */
export const isHoleWord = (word: string) => /^[^\s⟦⟧%][^\s⟦⟧]*$/.test(word);

/** `word` as a hole writes it: as it is where it can be, else URI-encoded after a `%`. */
export const holeWord = (word: string) =>
  isHoleWord(word) ? word : `%${encodeURIComponent(word)}`;

/** The word for the code a hole prints while its arg is unset: `?`, then the code URI-encoded. */
export const defaultWord = (code: string) => `?${encodeURIComponent(code)}`;

/** The code a {@link defaultWord} holds, or `undefined` for any other word. */
export const defaultCode = (word: string | undefined) =>
  word?.startsWith('?') ? decodeURIComponent(word.slice(1)) : undefined;

/** Whether code already holds a hole bracket, so holes written in it could not be found again. */
export const hasHoleBracket = (code: string) => /[⟦⟧]/.test(code);

/**
 * Replaces every hole in a template with what `fill` prints, given its words as {@link holeWord}
 * took them; see {@link FillSnippetTemplate}.
 */
export const fillHoles = (template: string, fill: (kind: string, words: string[]) => string) => {
  let filled = '';
  let end = 0;
  for (const match of template.matchAll(/⟦([^⟧]*)⟧/g)) {
    const [kind = '', ...words] = match[1]!.split(' ');
    const printed = fill(
      kind,
      words.map((word) => (word.startsWith('%') ? decodeURIComponent(word.slice(1)) : word))
    );
    const before = template.slice(end, match.index);
    const code = before.trimEnd();
    const takesSpace = ATTRIBUTE_HOLES.has(kind) || before.slice(code.length).includes('\n');
    filled += (printed || !takesSpace ? before : code) + printed;
    end = match.index + match[0].length;
  }
  return filled + template.slice(end);
};

const ATTRIBUTE_HOLES = new Set(['props', 'attr', 'bool', 'prop']);

/**
 * A printed value or the code the story writes an arg with, in parentheses unless code reading on
 * reads it the same: a name or a chain of names, a string, or code one pair of brackets encloses,
 * such as an array. So `5`, `-1`, `{ a: 1 }`, `() => null` and `MB * 5` get them, where `5.x`,
 * `--1`, `{ a: 1 }` as an arrow body or `MB * 5.toFixed()` would read differently.
 */
export const asOperand = (printed: string) =>
  /^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)*$/.test(printed) ||
  /^(["'])(?:\\.|(?!\1)[^\\\n])*\1$/.test(printed) ||
  enclosed(printed)
    ? printed
    : `(${printed})`;

// Whether the bracket `code` starts with closes at its end, as in `[1, [2]]`. Code whose brackets
// a template literal, a regex, a comment or JSX text could hold is not.
function enclosed(code: string) {
  const bare = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
  if (!/^[[(]/.test(bare) || /[`/<]/.test(bare)) {
    return false;
  }
  let depth = 0;
  for (let index = 0; index < bare.length; index++) {
    depth += '([{'.includes(bare[index]!) ? 1 : ')]}'.includes(bare[index]!) ? -1 : 0;
    if (depth === 0) {
      return index === bare.length - 1;
    }
  }
  return false;
}

/**
 * The args a `⟦props …⟧` spread passes: every arg but those its `-name` words name, which the
 * element writes itself.
 */
export function spreadArgs(args: Args, words: string[]): [string, unknown][] {
  const written = new Set(words.map((word) => word.slice(1)));
  return Object.entries(args).filter(([name]) => !written.has(name));
}

/**
 * Code cut from a story file at `column`, without the indentation its lines after the first share
 * there, as the first starts where the cut does.
 */
export function dedentStoryCode(text: string, column = Infinity): string {
  const [first, ...rest] = text.split('\n');
  const indents = rest.filter((line) => line.trim()).map((line) => /^\s*/.exec(line)![0].length);
  const indent = Math.min(column, ...indents);
  return [first, ...rest.map((line) => line.slice(indent))].join('\n');
}

/**
 * Prints an arg value as the JavaScript literal it would be written as, and a {@link writtenArg} as
 * its code. A value with no literal, such as a function, a class instance, a cycle or anything
 * `opaque` matches at any depth, throws an {@link UnprintableArgError} for `name`.
 */
export function printValue(
  value: unknown,
  name: string,
  { quote = '"', opaque }: { quote?: '"' | "'"; opaque?: (value: unknown) => boolean } = {}
): string {
  const code = writtenCode(value);
  if (code !== undefined) {
    return code;
  }
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
    const printed = Array.isArray(item) ? printArray(item) : printObject(item);
    parents.delete(item);
    return printed;
  };
  const printArray = (array: unknown[]) =>
    `[${Array.from(array, (_, index) => (index in array ? print(array[index]) : '')).join(', ')}]`;
  const printObject = (object: Record<string, unknown>) => {
    const properties: string[] = [];
    for (const key in object) {
      if (object[key] !== undefined) {
        const printedKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : print(key);
        properties.push(`${printedKey}: ${print(object[key])}`);
      }
    }
    return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`;
  };
  return print(value);
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
