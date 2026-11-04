// The story-docs snippet is printed twice by the same printer: once with the story's args, which is
// the static snippet, and once with a placeholder wherever it prints an arg's value, which marks
// the places the template wraps in holes. A placeholder is as wide as the value it stands for and
// keeps its whitespace, so the layout breaks lines and attributes as it does for the value. Markup
// or whitespace the layout reads inside a text value is not kept; see `show` below.
import type { SnippetTemplate, TemplateHole } from 'storybook/internal/docs-tools';

import type { AngularHolePlace } from '../snippet-values.ts';
import type { TemplateLayout } from '../template-grammar.ts';

type HoleKind = AngularHolePlace['kind'];

// Prints an arg's value where the snippet shows it.
export interface ArgPrinter {
  show(arg: string, kind: HoleKind, value: string): string;
  // What stands where the snippet would print an arg the story does not set, once a control sets
  // it: nothing in a print with values, a mark the layout ignores in a print with placeholders.
  unset(arg: string, kind: HoleKind): string | undefined;
  // How the layout measures this print; the static snippet's own measure where `undefined`.
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

interface PlaceholderPrinter extends ArgPrinter {
  // The template of `snippet`, from its print with this printer: each run of placeholders is the
  // text of the snippet there wrapped in its hole, and each mark an empty hole. `undefined` when the
  // two prints do not line up, as where the print lost a hole past the private-use range.
  template(printed: string, snippet: string): SnippetTemplate<AngularHolePlace> | undefined;
}

export const printPlaceholders = (): PlaceholderPrinter => {
  const holes = new Map<string, { arg: string; kind: HoleKind }>();
  let marks = 0;
  const mark = (arg: string, kind: HoleKind) => {
    const id = HOLE_MARKS.first + marks++;
    if (id > HOLE_MARKS.last) {
      // An overflow prints nothing, which `template` then finds no hole for.
      return '';
    }
    holes.set(String.fromCharCode(id), { arg, kind });
    return String.fromCharCode(id);
  };
  let values = 0;
  return {
    show(arg, kind, value) {
      if (value === '') {
        return mark(arg, kind);
      }
      const id = FIRST + values++;
      if (id > LAST) {
        // An overflow prints the value itself, which `template` then finds no hole for.
        return value;
      }
      const char = String.fromCharCode(id);
      holes.set(char, { arg, kind });
      // Text keeps the whitespace inside it, which splits an unquoted attribute value.
      return kind === 'text'
        ? value.replace(/^\s+|\s+$/g, (space) => char.repeat(space.length)).replace(/\S/g, char)
        : value.replace(/[^\n]/g, char);
    },
    unset: mark,
    layout: PLACEHOLDER_LAYOUT,
    template(printed, snippet) {
      if (PRIVATE_USE.test(snippet)) {
        return undefined;
      }
      // A mark stands for a value that prints nothing, and an unset binding for the whitespace
      // the printer puts before it too, a space or a line of its own: the length of that.
      const markAt = (index: number) => {
        WHITESPACE.lastIndex = index;
        const space = WHITESPACE.exec(printed)![0];
        const char = printed[index + space.length];
        if (space !== '' && isMark(char) && holes.get(char!)!.kind === 'prop') {
          return { mark: char!, space };
        }
        return isMark(printed[index]) ? { mark: printed[index]!, space: '' } : undefined;
      };
      // The code the snippet prints after `index` up to the next value, which it prints too.
      const codeAfter = (index: number) => {
        let code = '';
        while (index < printed.length && (isMark(printed[index]) || !holes.has(printed[index]!))) {
          const found = markAt(index);
          if (found) {
            index += found.space.length + 1;
          } else {
            code += printed[index++];
          }
        }
        return code;
      };
      const template: SnippetTemplate<AngularHolePlace> = [];
      // The code read since the last hole, which goes into the template before the next one.
      let literal = '';
      const push = (hole: TemplateHole<AngularHolePlace>) => {
        if (literal) {
          template.push(literal);
          literal = '';
        }
        template.push(hole);
      };
      let at = 0;
      for (let index = 0; index < printed.length;) {
        const char = printed[index]!;
        const found = markAt(index);
        if (found) {
          const { arg, kind } = holes.get(found.mark)!;
          push({ kind, arg, text: '', ...(found.space ? { space: found.space } : {}) });
          index += found.space.length + 1;
          continue;
        }
        const hole = holes.get(char);
        if (!hole) {
          if (snippet[at] !== char) {
            return undefined;
          }
          literal += char;
          index++;
          at++;
          continue;
        }
        // A value over several lines: the printer may indent the lines after the first, by the
        // same width each, which the preview indents a new value by too. Text spans the whitespace
        // inside it.
        const run = new RegExp(
          hole.kind === 'text' ? `${char}(?:\\s*${char})*` : `${char}+(?:\\n([ \\t]*)${char}+)*`,
          'y'
        );
        run.lastIndex = index;
        const value = run.exec(printed)![0];
        const indent = /\n( *)/.exec(value)?.[1].length ?? 0;
        index += value.length;
        // The snippet escapes the value for the template literal it stands in, so its text there
        // runs on to where the code after it does. Right before another value there is no such
        // code, so the value has to print as it is: escaping would put a backslash in its text.
        const after = codeAfter(index);
        if (
          after === '' &&
          index < printed.length &&
          snippet.slice(at, at + value.length).includes('\\')
        ) {
          return undefined;
        }
        const end =
          after !== ''
            ? snippet.indexOf(after, at + value.length)
            : index === printed.length
              ? snippet.length
              : at + value.length;
        if (end === -1) {
          return undefined;
        }
        push({
          kind: hole.kind,
          arg: hole.arg,
          ...(indent ? { indent } : {}),
          text: snippet.slice(at, end),
        });
        at = end;
      }
      if (at !== snippet.length) {
        return undefined;
      }
      if (literal) {
        template.push(literal);
      }
      return template;
    },
  };
};

const PRIVATE_USE = /[\ue000-\uf8ff]/;
const WHITESPACE = /\s*/y;

const isMark = (char: string | undefined) =>
  char !== undefined &&
  char.charCodeAt(0) >= HOLE_MARKS.first &&
  char.charCodeAt(0) <= HOLE_MARKS.last;
