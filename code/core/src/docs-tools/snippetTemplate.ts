import type { Args } from 'storybook/internal/types';

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

/** Thrown by a {@link FillSnippetTemplate} for an arg whose value the snippet cannot show. */
export class UnprintableArgError extends Error {
  override readonly name = 'UnprintableArgError';

  constructor(readonly argName: string) {
    super(`The snippet cannot show the value of the \`${argName}\` arg.`);
  }
}

/** A template hole; each word is one {@link isHoleWord} or written with {@link holeWord}. */
export const hole = (kind: string, ...words: string[]) => `⟦${[kind, ...words].join(' ')}⟧`;

/** Whether `word`, such as an arg name, can be written in a hole as it is. */
const isHoleWord = (word: string) => /^[^\s⟦⟧%~][^\s⟦⟧]*$/.test(word);

/** `word` as a hole writes it: as it is where it can be, else URI-encoded after a `%`. */
export const holeWord = (word: string) =>
  isHoleWord(word) ? word : `%${encodeURIComponent(word)}`;

/** Whether code already holds a hole bracket, so holes written in it could not be found again. */
export const hasHoleBracket = (code: string) => /[⟦⟧]/.test(code);

const HOLE = /⟦([^⟧]*)⟧/g;

/** A hole {@link findHoles} found: where it is, its kind, and its words as {@link holeWord} took them. */
export interface Hole {
  start: number;
  end: number;
  kind: string;
  words: string[];
}

const decodeWord = (word: string) => (word.startsWith('%') ? decodeURIComponent(word.slice(1)) : word);

/** Every hole in a template, for the server and tests; a filler uses {@link fillHoles}. */
export const findHoles = (template: string): Hole[] =>
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
    const printed = fill(
      kind,
      words
        .filter((word) => word !== space)
        .map(decodeWord)
    );
    return printed && space ? decodeURIComponent(space.slice(1)) + printed : printed;
  });

/**
 * The template with the whitespace before each hole `takesSpace` names moved into it, as a
 * `~space` word. The framework's story-docs provider calls it on the template it writes, naming
 * the holes that leave nothing behind while they print nothing, such as an attribute.
 */
export const withHoleSpace = (
  template: string,
  takesSpace: (kind: string, space: string) => boolean
) => {
  let moved = '';
  let end = 0;
  for (const { start, end: holeEnd, kind } of findHoles(template)) {
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
