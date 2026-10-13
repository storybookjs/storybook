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
 * Prints an arg value as the JavaScript literal it would be written as. A value with no literal,
 * such as a function or a class instance, throws an {@link UnprintableArgError} for `name`.
 */
export function printValue(value: unknown, name: string, quote: '"' | "'" = '"'): string {
  if (typeof value === 'string') {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replaceAll(quote, `\\${quote}`);
    return `${quote}${escaped}${quote}`;
  }
  if (value === null || ['undefined', 'number', 'boolean'].includes(typeof value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => printValue(item, name, quote)).join(', ')}]`;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => {
        const printedKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : printValue(key, name, quote);
        return `${printedKey}: ${printValue(item, name, quote)}`;
      });
    return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
  }
  throw new UnprintableArgError(name);
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
