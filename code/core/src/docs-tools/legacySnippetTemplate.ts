import type { Args } from 'storybook/internal/types';

import { UnprintableArgError } from './snippetTemplate.ts';

// The hole contract before SB-2250 moved to wrapping holes; the Vue, Svelte, Web Components and
// Angular providers use it until they move too.

/**
 * Fills a story-docs `template` with the current args, so the story's snippet follows the controls.
 *
 * A template is the story's static snippet, printed by the same printer, with a hole,
 * `⟦kind word…⟧`, wherever that printer writes an arg's value. This module is the contract every
 * framework shares: how a hole is written ({@link hole}, {@link holeWord}), found
 * ({@link findHoles}) and replaced ({@link fillHoles}). Which kinds and words a framework writes,
 * and how its filler prints each, is the framework's own, documented on its filler.
 *
 * Words are separated by one space. A word that starts with `%` is the rest of it URI-encoded, so
 * any arg name can be a word. A `~space` word is the whitespace before the hole, which is printed
 * before a value that is not empty, so an unset attribute leaves no gap or empty line; the
 * framework decides which holes take it, see {@link withHoleSpace}. The filler reads nothing but
 * the hole.
 *
 * A renderer sets its filler as `parameters.docs.source.fillTemplate`. It throws an
 * {@link UnprintableArgError} for a value the snippet cannot show, and the static snippet is shown
 * instead. `snippetValues.ts` holds JavaScript printing helpers several fillers share, which are not
 * part of this contract.
 */
export type FillSnippetTemplate = (template: string, args: Args) => string;

/** A template hole; each word is one {@link isHoleWord} or written with {@link holeWord}. */
export const legacyHole = (kind: string, ...words: string[]) => `⟦${[kind, ...words].join(' ')}⟧`;

const HOLE = /⟦([^⟧]*)⟧/g;

/** A hole {@link findHoles} found: where it is, its kind, and its words as {@link holeWord} took them. */
export interface Hole {
  start: number;
  end: number;
  kind: string;
  words: string[];
}

const decodeWord = (word: string) =>
  word.startsWith('%') ? decodeURIComponent(word.slice(1)) : word;

/** Every hole in a template, for the server and tests; a filler uses {@link fillHoles}. */
export const legacyFindHoles = (template: string): Hole[] =>
  [...template.matchAll(HOLE)].map((match) => {
    const [kind = '', ...words] = match[1]!.split(' ');
    return {
      start: match.index,
      end: match.index + match[0].length,
      kind,
      words: words.map(decodeWord),
    };
  });

/**
 * Replaces every hole in a template with what `fill` prints for its kind and words, with `%` words
 * decoded and the `~space` word printed before a value that is not empty. `fill` gets nothing
 * else, so it cannot read the code around a hole.
 */
export const fillHoles = (template: string, fill: (kind: string, words: string[]) => string) =>
  template.replace(HOLE, (_, inside: string) => {
    const [kind = '', ...words] = inside.split(' ');
    const space = words.find((word) => word.startsWith('~'));
    const printed = fill(kind, words.filter((word) => word !== space).map(decodeWord));
    return printed && space ? decodeURIComponent(space.slice(1)) + printed : printed;
  });

/**
 * The template with the whitespace before each hole `takesSpace` names moved into it, as a
 * `~space` word. The framework's story-docs provider calls it on the template it writes, naming
 * the holes that leave nothing behind while they print nothing, such as an attribute.
 */
export const legacyWithHoleSpace = (
  template: string,
  takesSpace: (kind: string, space: string) => boolean
) => {
  let moved = '';
  let end = 0;
  for (const { start, end: holeEnd, kind } of legacyFindHoles(template)) {
    const before = template.slice(end, start);
    const code = before.trimEnd();
    const space = before.slice(code.length);
    const written = template.slice(start, holeEnd);
    moved +=
      space !== '' && takesSpace(kind, space)
        ? `${code}${written.slice(0, -1)} ~${encodeURIComponent(space)}⟧`
        : before + written;
    end = holeEnd;
  }
  return moved + template.slice(end);
};

// JavaScript printing helpers that the React, Vue and Svelte fillers share. They are not part of
// the hole contract in `snippetTemplate.ts`: a framework's filler may use them or not.

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
  { unmappedArgs, initialArgs }: { args: Args; unmappedArgs: Args; initialArgs: Args },
  argCode: Record<string, string> = {}
): Args =>
  // The unmapped args, as the static snippet reads them: an `argTypes` mapping changes only what
  // the story renders with. An initial arg the args store dropped, as it drops one set to
  // `undefined`, is still the story's.
  Object.fromEntries(
    [...new Set([...Object.keys(initialArgs), ...Object.keys(unmappedArgs)])].map((name) => {
      const value = unmappedArgs[name];
      return [
        name,
        Object.hasOwn(argCode, name) && value === initialArgs[name]
          ? writtenArg(argCode[name]!)
          : value,
      ];
    })
  );

/** The code a {@link writtenArg} holds, or `undefined` for any other value. */
export const writtenCode = (value: unknown): string | undefined =>
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

/** The word for the code a hole prints while its arg is unset: `?`, then the code URI-encoded. */
export const defaultWord = (code: string) => `?${encodeURIComponent(code)}`;

/** The code a {@link defaultWord} holds, or `undefined` for any other word. */
export const defaultCode = (word: string | undefined) =>
  word?.startsWith('?') ? decodeURIComponent(word.slice(1)) : undefined;

/**
 * The args a `⟦props …⟧` spread passes: every arg but those its `-name` words name, which the
 * element writes itself.
 */
export function spreadArgs(args: Args, words: string[]): [string, unknown][] {
  const written = new Set(words.map((word) => word.slice(1)));
  return Object.entries(args).filter(([name]) => !written.has(name));
}

/**
 * Prints an arg value as the JavaScript literal it would be written as, and a {@link writtenArg} as
 * its code. A value with no literal, such as a function, a class instance, a cycle or anything
 * `opaque` matches at any depth, throws an {@link UnprintableArgError} for `name`.
 */
export function legacyPrintValue(
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
