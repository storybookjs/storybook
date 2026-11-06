import { isEqual } from 'es-toolkit/predicate';

import type { Args } from 'storybook/internal/types';

/**
 * The contract between a story-docs provider, which writes a story's `template`, and the preview,
 * which fills it with the story's current args so its snippet follows the controls.
 *
 * A template is the story's static snippet split into segments: code as written, and holes. A hole
 * is a place an arg prints, with the `text` the static snippet prints there. Joining every segment,
 * with each hole's `text`, gives the static snippet; see {@link stripHoles}.
 *
 * {@link fillTemplate} prints a hole whose arg still holds its initial value as its `text`, so
 * nothing the controls did not change moves. The renderer prints only a changed value, for the
 * place its hole describes.
 *
 * Core does not know any place: a renderer types its own as a union of {@link HolePlace}s, and shares
 * that type between its provider, which writes the holes, and its {@link PrintHole}, which prints
 * them. A hole is flat: the place's own fields stand next to the fields core reads, `arg`, `spread`,
 * `text` and `space`, which a place therefore does not use, such as
 * `{ kind: 'attr', arg: 'label', text: ' label="Go"', space: ' ' }`.
 */
export type SnippetTemplate<Place extends HolePlace = HolePlace> = (string | TemplateHole<Place>)[];

/**
 * Where a hole stands in a renderer's code, such as an attribute or a text node: its `kind` and the
 * renderer's own fields for it, named other than `arg`, `spread`, `text` and `space`.
 */
export interface HolePlace {
  /** Tells the renderer's places apart. */
  kind: string;
}

/**
 * A hole as its renderer prints it: its place, and which args it reads. A hole reads one `arg`, or,
 * as a `spread` hole, every arg a control set, of which the renderer prints those the place does not
 * print already.
 */
export type HoleRef<Place extends HolePlace = HolePlace> = Place &
  ({ arg: string; spread?: never } | { spread: true; arg?: never });

/** A hole of a {@link SnippetTemplate}. */
export type TemplateHole<Place extends HolePlace = HolePlace> = HoleRef<Place> & {
  /** What the static snippet prints here, with the `space` before it, if any. */
  text: string;
  /**
   * Printed before what the renderer prints here, unless that is empty, such as the whitespace
   * before an attribute, so a cleared attribute leaves no gap. It is part of `text` already: a hole
   * whose `text` is empty gets it from its provider, any other one from {@link withHoleSpace}.
   */
  space?: string;
};

/**
 * Prints an arg value a control changed for the place `hole` describes, or, for a `spread` hole, the
 * args a control set, but those the place already prints. The renderer registers it with
 * {@link registerPrintHole}. It sees only the hole's place, never the code around it.
 *
 * @throws {UnprintableArgError} For a value the snippet cannot show.
 */
export type PrintHole<Place extends HolePlace = HolePlace> = (
  hole: HoleRef<Place>,
  value: unknown
) => string;

// On `globalThis`, not in this module: the manager bundles a renderer's printer module with its own
// copy of this file.
const PRINT_HOLE = Symbol.for('storybook/docs-tools/print-hole');

type GlobalWithPrintHole = typeof globalThis & { [PRINT_HOLE]?: PrintHole<any> };

/** Registers the renderer's {@link PrintHole}; see `printHole` of `experimental_storyDocsProvider`. */
export function registerPrintHole(printHole: PrintHole<any>): void {
  (globalThis as GlobalWithPrintHole)[PRINT_HOLE] = printHole;
}

export const getPrintHole = (): PrintHole | undefined =>
  (globalThis as GlobalWithPrintHole)[PRINT_HOLE];

/** Thrown by a {@link PrintHole} for an arg whose value the snippet cannot show. */
export class UnprintableArgError extends Error {
  override readonly name = 'UnprintableArgError';

  constructor(readonly argName: string) {
    super(`The snippet cannot show the current value of the \`${argName}\` arg.`);
  }
}

/**
 * Throws for a hole place a {@link PrintHole} has no case for. Called with the place in the
 * `default` branch of a switch on its `kind`, or with the kind itself where the places share one
 * shape, it fails to compile while a kind of the renderer's places is left out.
 */
export const unknownHoleKind = (place: never): never => {
  const kind = typeof place === 'object' ? (place as HolePlace | null)?.kind : place;
  throw new Error(`Unknown hole kind \`${String(kind)}\``);
};

const isHole = <Place extends HolePlace>(
  segment: string | TemplateHole<Place>
): segment is TemplateHole<Place> => typeof segment !== 'string';

/** The static snippet a template is written from. */
export const stripHoles = (template: SnippetTemplate<any>): string =>
  template.map((segment) => (isHole(segment) ? segment.text : segment)).join('');

/**
 * Fills a template with the args a story renders with before they are mapped: a hole whose arg
 * holds its initial value prints its `text`, and every other hole what `printHole` prints for it,
 * after its `space` unless that is empty. A `spread` hole gets every arg a control set; its
 * renderer leaves out those its place already prints.
 *
 * @throws {UnprintableArgError} When `printHole` cannot print a value.
 */
export const fillTemplate = <Place extends HolePlace>(
  // Any template: a payload types its places as `HolePlace`, the renderer's `printHole` as its own.
  template: SnippetTemplate<any>,
  { unmappedArgs, initialArgs }: { unmappedArgs: Args; initialArgs: Args },
  printHole: PrintHole<Place>
): string => {
  const own = (args: Args, name: string) => (Object.hasOwn(args, name) ? args[name] : undefined);
  const changed = (name: string) => !isEqual(own(unmappedArgs, name), own(initialArgs, name));
  const added = Object.fromEntries(
    Object.entries(unmappedArgs).filter(([name, value]) => value !== undefined && changed(name))
  );
  const print = (hole: TemplateHole<Place>) => {
    if (hole.spread) {
      return Object.keys(added).length === 0 ? undefined : printHole(ref(hole), added);
    }
    return changed(hole.arg) ? printHole(ref(hole), own(unmappedArgs, hole.arg)) : undefined;
  };
  return template
    .map((segment) => {
      if (!isHole(segment)) {
        return segment;
      }
      const printed = print(segment);
      if (printed === undefined) {
        return segment.text;
      }
      return printed && segment.space ? segment.space + printed : printed;
    })
    .join('');
};

// The hole as its renderer sees it: without the code the snippet prints there.
const ref = <Place extends HolePlace>({
  text: _text,
  space: _space,
  ...hole
}: TemplateHole<Place>): HoleRef<Place> => hole as HoleRef<Place>;

/**
 * The template with the whitespace before each hole `takesSpace` names moved into it, as its
 * `space`, so the place leaves no gap or empty line while it prints nothing, as an attribute does
 * whose arg a control cleared. A hole that prints no text, or has a `space` already, keeps the
 * whitespace before it.
 */
export const withHoleSpace = <Template extends SnippetTemplate<any>>(
  template: Template,
  takesSpace: (hole: HoleRef<PlaceOf<Template>>) => boolean
): Template => {
  const result: SnippetTemplate<any> = [];
  for (const segment of template) {
    const previous = result.at(-1);
    const space = typeof previous === 'string' ? /\s+$/.exec(previous)?.[0] : undefined;
    if (
      !isHole(segment) ||
      space === undefined ||
      segment.text === '' ||
      segment.space !== undefined ||
      !takesSpace(ref(segment))
    ) {
      result.push(segment);
      continue;
    }
    const before = (previous as string).slice(0, -space.length);
    if (before) {
      result[result.length - 1] = before;
    } else {
      result.pop();
    }
    result.push({ ...segment, text: space + segment.text, space });
  }
  return result as Template;
};

// The places of a template's holes.
type PlaceOf<Template> = Template extends SnippetTemplate<infer Place> ? Place : never;

/** The template with `code`, such as an import block, before it. */
export const prependToTemplate = <Place extends HolePlace>(
  code: string,
  template: SnippetTemplate<Place>
): SnippetTemplate<Place> =>
  !code
    ? template
    : typeof template[0] === 'string'
      ? [code + template[0], ...template.slice(1)]
      : [code, ...template];

/** Whether `value` has the shape of a {@link SnippetTemplate}, as a provider must return it. */
export const isSnippetTemplate = (value: unknown): value is SnippetTemplate =>
  Array.isArray(value) &&
  value.every(
    (segment) =>
      typeof segment === 'string' ||
      (typeof segment === 'object' &&
        segment !== null &&
        typeof segment.text === 'string' &&
        typeof segment.kind === 'string' &&
        (segment.space === undefined || typeof segment.space === 'string') &&
        ((segment.spread === undefined && typeof segment.arg === 'string') ||
          (segment.spread === true && segment.arg === undefined)))
  );

/**
 * A template written as one string, for test snapshots and debugging only: each hole as
 * `⟦kind arg field=value… ~space⟫text⟧`, with `*` for a spread hole's arg. It is not read back.
 */
export const formatTemplate = (template: SnippetTemplate<any>): string =>
  template
    .map((segment) => {
      if (!isHole(segment)) {
        return segment;
      }
      const { kind, arg, spread, text, space, ...fields } = segment as TemplateHole &
        Record<string, unknown>;
      const header = [
        kind,
        spread ? '*' : arg,
        ...Object.entries(fields).map(([name, value]) => `${name}=${JSON.stringify(value)}`),
        ...(space === undefined ? [] : [`~${JSON.stringify(space)}`]),
      ];
      return `⟦${header.join(' ')}⟫${text}⟧`;
    })
    .join('');

/**
 * Marks for a provider that prints a snippet once with each place an arg prints marked, and turns
 * the marks into holes afterwards; see {@link createHoleMarks}.
 */
export interface HoleMarks<Place extends HolePlace> {
  /**
   * `text`, marked as a hole for `ref`, with `space` as its {@link TemplateHole.space}, which the
   * static snippet does not print: give it to a hole that prints no text, and let
   * {@link withHoleSpace} take the whitespace before any other. The same hole marks the same text
   * alike, so a provider that compares printed code, as to declare a repeated value once, compares
   * marked code as it compares the snippet.
   */
  mark(ref: HoleRef<Place>, text: string, space?: string): string;
  /**
   * The template of code printed with marks, or `undefined` when its marks do not pair up, as when
   * one is printed inside another.
   */
  toTemplate(marked: string): SnippetTemplate<Place> | undefined;
}

/**
 * Marks a provider prints a snippet with, to find the places an arg prints in it again. A mark is
 * written with private-use characters none of `sources` holds, so code as written is never read as
 * a mark. Pass the static snippet: it holds everything the marked print holds but the marks,
 * including values printed from other files. `wrap` writes each mark where the printed code must
 * still parse, such as inside a block comment.
 */
export function createHoleMarks<Place extends HolePlace>(
  sources: string[],
  wrap: (mark: string) => string = (mark) => mark
): HoleMarks<Place> {
  const [open, middle, close] = unusedPrivateUseCharacters(3, sources.join(''));
  const holes: { ref: HoleRef<Place>; space?: string }[] = [];
  const indexes = new Map<string, number>();
  // The index of the hole for `ref` and `space`, the same for the same hole.
  const indexOf = (ref: HoleRef<Place>, space: string | undefined) => {
    const key = JSON.stringify([ref, space]);
    let index = indexes.get(key);
    if (index === undefined) {
      index = holes.push({ ref, ...(space && { space }) }) - 1;
      indexes.set(key, index);
    }
    return index;
  };
  const [before = '', after = ''] = wrap('\0').split('\0');
  const quote = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const pattern = new RegExp(
    `${quote(before + open)}(\\d+)${quote(middle + after)}([\\s\\S]*?)${quote(before + close + after)}`,
    'g'
  );
  const markCharacters = new RegExp(`[${open}${middle}${close}]`);

  return {
    mark: (ref, text, space) =>
      `${wrap(`${open}${indexOf(ref, space || undefined)}${middle}`)}${text}${wrap(close)}`,
    toTemplate(marked) {
      const template: SnippetTemplate<Place> = [];
      let cursor = 0;
      for (const match of marked.matchAll(pattern)) {
        const code = marked.slice(cursor, match.index);
        const [, index, text] = match as unknown as [string, string, string];
        const hole = holes[Number(index)];
        if (!hole || markCharacters.test(code) || markCharacters.test(text)) {
          return undefined;
        }
        if (code) {
          template.push(code);
        }
        template.push({
          ...hole.ref,
          text,
          ...(hole.space !== undefined && { space: hole.space }),
        } as TemplateHole<Place>);
        cursor = match.index + match[0].length;
      }
      const rest = marked.slice(cursor);
      if (markCharacters.test(rest)) {
        return undefined;
      }
      if (rest) {
        template.push(rest);
      }
      return template;
    },
  };
}

// `count` characters of the Unicode private use area that `text` does not hold.
function unusedPrivateUseCharacters(count: number, text: string): string[] {
  const found: string[] = [];
  for (let code = 0xe000; code <= 0xf8ff && found.length < count; code++) {
    const character = String.fromCharCode(code);
    if (!text.includes(character)) {
      found.push(character);
    }
  }
  return found;
}
