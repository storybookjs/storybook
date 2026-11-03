// The story-docs snippet is printed twice by the same printer: once with the story's args, which is
// the static snippet, and once with a placeholder wherever it prints an arg's value, which becomes
// the template the preview fills. A placeholder is as wide as the value it stands for and keeps its
// whitespace, so the layout breaks lines and attributes as it does for the value. Markup or
// whitespace the layout reads inside a text value is not kept; see `show` below.
import { legacyHole as hole, holeWord } from 'storybook/internal/docs-tools';

import type { TemplateLayout } from '../template-grammar.ts';

/**
 * Where a snippet prints an arg's value, which decides how the preview prints a new one there:
 *
 * - `bind`: the expression of a `[name]="…"` binding.
 * - `prop`: a whole `[name]="…"` binding `argsToTemplate` expands, which an unset arg leaves out.
 * - `field`: the code of a host component field.
 * - `text`: text the story's markup interpolates.
 */
export type HoleKind = 'bind' | 'prop' | 'field' | 'text';

/** Prints an arg's value where the snippet shows it. */
export interface ArgPrinter {
  /** `code` is the code the story writes the arg with, when `value` is that code. */
  show(arg: string, kind: HoleKind, value: string, code?: string): string;
  /**
   * What stands where the snippet would print an arg the story does not set, once a control sets
   * it: nothing in a print with values, a mark the layout ignores in a print with placeholders.
   */
  unset(arg: string, kind: HoleKind): string | undefined;
  /** How the layout measures this print; next's own measure where `undefined`. */
  layout?: TemplateLayout;
}

export const printValues: ArgPrinter = {
  show: (_arg, _kind, value) => value,
  unset: () => undefined,
};

// One private-use character per hole that prints a value, and one mark, which the layout reads as
// nothing, per hole that prints none: an empty value, or an arg the story does not set.
const FIRST = 0xe000;
const HOLE_MARKS = { first: 0xf700, last: 0xf8ff };
const LAST = HOLE_MARKS.first - 1;

const HOLE_MARK = / ?[\uf700-\uf8ff]/g;

// The layout of a print with placeholders reads a mark, with the space before it, as nothing.
const PLACEHOLDER_LAYOUT: TemplateLayout = {
  length: (text) => text.replace(HOLE_MARK, '').length,
  isEmpty: (text) => text.replace(HOLE_MARK, '') === '',
};

export interface PlaceholderPrinter extends ArgPrinter {
  /**
   * The template of a snippet printed with this printer: each placeholder replaced by its hole, or
   * `undefined` when the print lost one, as a hole past the private-use range does.
   */
  template(printed: string): string | undefined;
  /** The code each arg is written with where the snippet shows it, as `StoryDoc.argCode` holds. */
  argCode(): Record<string, string> | undefined;
}

export const printPlaceholders = (): PlaceholderPrinter => {
  const holes: { arg: string; kind: HoleKind; char: string }[] = [];
  const code: Record<string, string> = {};
  let conflicting = false;
  let marks = 0;
  const mark = (arg: string, kind: HoleKind) => {
    const id = HOLE_MARKS.first + marks++;
    if (id > HOLE_MARKS.last) {
      // An overflow prints nothing, which `template` then finds no hole for.
      return '';
    }
    holes.push({ arg, kind, char: String.fromCharCode(id) });
    return String.fromCharCode(id);
  };
  let values = 0;
  return {
    show(arg, kind, value, written) {
      if (written !== undefined) {
        conflicting ||= Object.hasOwn(code, arg) && code[arg] !== written;
        code[arg] = written;
      }
      if (value === '') {
        return mark(arg, kind);
      }
      const id = FIRST + values++;
      if (id > LAST) {
        // An overflow prints the value itself, which `template` then finds no hole for.
        return value;
      }
      const char = String.fromCharCode(id);
      holes.push({ arg, kind, char });
      // Text keeps the whitespace inside it, which splits an unquoted attribute value.
      return kind === 'text'
        ? value.replace(/^\s+|\s+$/g, (space) => char.repeat(space.length)).replace(/\S/g, char)
        : value.replace(/[^\n]/g, char);
    },
    unset: mark,
    layout: PLACEHOLDER_LAYOUT,
    template(printed) {
      let template = printed;
      for (const { arg, kind, char } of holes) {
        // A value over several lines: the printer may indent the lines after the first, by the
        // same width each, which the preview indents a new value by too. Text spans the whitespace
        // inside it. A value the snippet prints twice, as two `argsToTemplate` calls do, is two
        // holes.
        const run = new RegExp(
          kind === 'text' ? `${char}(?:\\s*${char})*` : `${char}+(?:\\n([ \\t]*)${char}+)*`,
          'g'
        );
        template = template.replace(run, (found: string) => {
          const indent = /\n( *)/.exec(found)?.[1] ?? '';
          return hole(kind, holeWord(arg), ...(indent ? [`+${indent.length}`] : []));
        });
      }
      return /[\ue000-\uf8ff]/.test(template) ? undefined : template;
    },
    argCode: () => (conflicting ? undefined : code),
  };
};
