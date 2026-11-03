import { isEqual } from 'es-toolkit/predicate';

import type { Args } from 'storybook/internal/types';

/**
 * The contract between a story-docs provider, which writes a story's `template`, and the preview,
 * which fills it with the story's current args so its snippet follows the controls.
 *
 * A template is the story's static snippet with each place an arg prints wrapped in a hole,
 * `⟦kind arg word…⟫text⟧`. `text` is what the static snippet prints there. `arg` is the arg the
 * place reads, or `*` for the args a control set, as a spread passes them, which the renderer
 * prints but those its words name. `kind` and the other words are the renderer's, for its {@link PrintHole}. Words are
 * separated by one space, and one that starts with `%` is the rest of it URI-encoded. A `~space`
 * word is text, such as the whitespace before an attribute, that is printed before the hole's
 * print unless that is empty; see {@link withHoleSpace}.
 *
 * {@link fillTemplate} prints a hole whose arg still holds its initial value as its `text`, so
 * nothing the controls did not change moves. The renderer prints only a changed value, for the
 * place its hole describes.
 */
export interface TemplateHole {
  kind: string;
  /** The arg the place reads, or `undefined` for the args a control set. */
  arg?: string;
  words: string[];
}

/**
 * Prints an arg value a control changed for the place `hole` describes, or, for a hole without an
 * `arg`, the args a control set, but those the place already prints. The renderer sets it as
 * `parameters.docs.source.printHole`.
 *
 * @throws {UnprintableArgError} For a value the snippet cannot show.
 */
export type PrintHole = (hole: TemplateHole, value: unknown) => string;

/** Thrown by a {@link PrintHole} for an arg whose value the snippet cannot show. */
export class UnprintableArgError extends Error {
  override readonly name = 'UnprintableArgError';

  constructor(readonly argName: string) {
    super(`The snippet cannot show the current value of the \`${argName}\` arg.`);
  }
}

const isHoleWord = (word: string) => /^[^\s⟦⟧⟫%~*][^\s⟦⟧⟫]*$/.test(word);

// `word` as a hole writes it: as it is where it can be, else URI-encoded after a `%`.
const holeWord = (word: string) => (isHoleWord(word) ? word : `%${encodeURIComponent(word)}`);

/**
 * A hole that prints `text` in the static snippet, and `space` before what it prints once its arg
 * changes, unless that is empty; see {@link TemplateHole}.
 */
export const hole = ({ kind, arg, words }: TemplateHole, text: string, space?: string) => {
  const header = [kind, arg === undefined ? '*' : holeWord(arg), ...words.map(holeWord)];
  return `⟦${[...header, ...(space ? [`~${encodeURIComponent(space)}`] : [])].join(' ')}⟫${text}⟧`;
};

/** Whether code already holds a hole bracket, so holes written in it could not be found again. */
export const hasHoleBracket = (code: string) => /[⟦⟧⟫]/.test(code);

const HOLE = /⟦([^⟫⟧]*)⟫([^⟧]*)⟧/g;

const decodeWord = (word: string) =>
  word.startsWith('%') ? decodeURIComponent(word.slice(1)) : word;

// Each hole of a template replaced by what `print` prints for it, after its `~space` word unless
// that is empty.
const printHoles = (
  template: string,
  print: (hole: TemplateHole, text: string) => string
): string =>
  template.replace(HOLE, (_, header: string, text: string) => {
    const [kind = '', arg = '', ...words] = header.split(' ');
    const space = words.find((word) => word.startsWith('~'));
    const printed = print(
      {
        kind,
        arg: arg === '*' ? undefined : decodeWord(arg),
        words: words.filter((word) => word !== space).map(decodeWord),
      },
      text
    );
    return printed && space ? decodeURIComponent(space.slice(1)) + printed : printed;
  });

/** The static snippet a template is written from. */
export const stripHoles = (template: string) => printHoles(template, (_, text) => text);

/**
 * Fills a template with the args a story renders with before they are mapped: a hole whose arg
 * holds its initial value prints its `text`, and every other hole what `printHole` prints for it.
 * A hole without an arg gets every arg a control set; its renderer leaves out those its place
 * already prints, which the hole's words name.
 *
 * @throws {UnprintableArgError} When `printHole` cannot print a value.
 */
export const fillTemplate = (
  template: string,
  { unmappedArgs, initialArgs }: { unmappedArgs: Args; initialArgs: Args },
  printHole: PrintHole
) => {
  const own = (args: Args, name: string) => (Object.hasOwn(args, name) ? args[name] : undefined);
  const changed = (name: string) => !isEqual(own(unmappedArgs, name), own(initialArgs, name));
  const added = Object.fromEntries(
    Object.entries(unmappedArgs).filter(([name, value]) => value !== undefined && changed(name))
  );
  return printHoles(template, (hole, text) => {
    if (hole.arg === undefined) {
      return Object.keys(added).length === 0 ? text : printHole(hole, added);
    }
    return changed(hole.arg) ? printHole(hole, own(unmappedArgs, hole.arg)) : text;
  });
};

/**
 * The template with the whitespace before each hole `takesSpace` names moved into it, as a
 * `~space` word, so the place leaves no gap or empty line while it prints nothing, as an attribute
 * does whose arg a control cleared. A hole that prints no text keeps the whitespace before it.
 */
export const withHoleSpace = (template: string, takesSpace: (kind: string) => boolean) =>
  template.replace(
    /(\s+)⟦([^⟫⟧]*)⟫([^⟧]*)⟧/g,
    (written, space: string, header: string, text: string) =>
      text !== '' && takesSpace(header.split(' ')[0]!)
        ? `⟦${header} ~${encodeURIComponent(space)}⟫${text}⟧`
        : written
  );
