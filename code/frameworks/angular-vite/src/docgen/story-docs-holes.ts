// The story-docs snippet is printed twice by the same printer: once with the story's args, which is
// the static snippet, and once with a placeholder wherever it prints an arg's value, which becomes
// the template the preview fills. A placeholder has the exact shape of the value it stands for, so
// every layout decision the printer makes (line length, line breaks, indentation) is the same in
// both prints.
import { hole, holeWord } from 'storybook/internal/docs-tools';

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
}

export const printValues: ArgPrinter = { show: (_arg, _kind, value) => value };

// One private-use character per hole. The 6400 of the basic plane are far more than any story
// shows.
const FIRST = 0xe000;
const LAST = 0xf8ff;

export interface PlaceholderPrinter extends ArgPrinter {
  /**
   * The template of a snippet printed with this printer: each placeholder replaced by its hole, or
   * `undefined` when one cannot be told apart, such as a value printed in two places.
   */
  template(printed: string): string | undefined;
  /** The code each arg is written with where the snippet shows it, as `StoryDoc.argCode` holds. */
  argCode(): Record<string, string> | undefined;
}

export const printPlaceholders = (): PlaceholderPrinter => {
  const holes: { arg: string; kind: HoleKind }[] = [];
  const code: Record<string, string> = {};
  let conflicting = false;
  return {
    show(arg, kind, value, written) {
      if (written !== undefined) {
        conflicting ||= Object.hasOwn(code, arg) && code[arg] !== written;
        code[arg] = written;
      }
      const id = FIRST + holes.length;
      holes.push({ arg, kind });
      // An overflow prints the value itself, which `template` then finds no hole for.
      return id > LAST ? value : value.replace(/[^\n]/g, String.fromCharCode(id));
    },
    template(printed) {
      let template = printed;
      for (const [index, { arg, kind }] of holes.entries()) {
        const char = String.fromCharCode(FIRST + index);
        // A value over several lines: the printer may indent the lines after the first, by the
        // same width each, which the preview indents a new value by too.
        const runs = [...printed.matchAll(new RegExp(`${char}+(?:\\n([ \\t]*)${char}+)*`, 'g'))];
        if (runs.length !== 1) {
          // Printed nowhere, as an empty value is, or twice.
          if (runs.length > 1) {
            return undefined;
          }
          continue;
        }
        const [run] = runs[0]!;
        const indent = /\n( *)/.exec(run)?.[1] ?? '';
        template = template.replace(run, () =>
          hole(kind, holeWord(arg), ...(indent ? [`+${indent.length}`] : []))
        );
      }
      return /[-]/.test(template) ? undefined : template;
    },
    argCode: () => (conflicting ? undefined : code),
  };
};
