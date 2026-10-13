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
 *
 * An attribute hole prints the space before each attribute, so the provider writes it right after
 * the tag name or the previous attribute. A renderer sets its filler as
 * `parameters.docs.source.fillTemplate`. It throws an {@link UnprintableArgError} for a value the
 * snippet cannot show, and the static snippet is shown instead.
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

/** Replaces every hole in a template with what `fill` prints for it. */
export const fillHoles = (template: string, fill: (kind: string, words: string[]) => string) =>
  template.replace(/⟦([^⟧]*)⟧/g, (_, body: string) => {
    const [kind, ...words] = body.split(' ');
    return fill(kind!, words);
  });

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
 * such as a function, a class instance or anything `opaque` matches at any depth, throws an
 * {@link UnprintableArgError} for `name`.
 */
export function printValue(
  value: unknown,
  name: string,
  { quote = '"', opaque }: { quote?: '"' | "'"; opaque?: (value: unknown) => boolean } = {}
): string {
  const print = (item: unknown): string => {
    if (opaque?.(item)) {
      throw new UnprintableArgError(name);
    }
    if (typeof item === 'string') {
      const escaped = item
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replaceAll(quote, `\\${quote}`);
      return `${quote}${escaped}${quote}`;
    }
    if (item === null || ['undefined', 'number', 'boolean'].includes(typeof item)) {
      return String(item);
    }
    if (Array.isArray(item)) {
      return `[${item.map(print).join(', ')}]`;
    }
    if (isPlainObject(item)) {
      const entries = Object.entries(item)
        .filter(([, entry]) => entry !== undefined)
        .map(
          ([key, entry]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : print(key)}: ${print(entry)}`
        );
      return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
    }
    throw new UnprintableArgError(name);
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
