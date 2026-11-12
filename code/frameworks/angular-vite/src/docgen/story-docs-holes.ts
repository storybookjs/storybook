// The story-docs snippet is printed twice by the same printer: once with the story's args, which is
// the static snippet, and once with each place it prints an arg's value marked through core's
// `createHoleMarks`, which the template is read from. The layout measures the marked print without
// its marks, so it breaks lines where the static snippet does.
import {
  type SnippetTemplate,
  type TemplateHole,
  createHoleMarks,
  stripHoles,
  withHoleSpace,
} from 'storybook/internal/docs-tools';

import type { AngularHolePlace } from '../snippet-values.ts';

// Prints an arg's value where the snippet shows it.
export interface ArgPrinter {
  show(arg: string, kind: AngularHolePlace['kind'], value: string): string;
  // What stands where the snippet would bind an input the story does not set, once a control sets
  // it: nothing in the print with values, an empty mark in the marked print.
  unset(arg: string): string | undefined;
  // The code as the static snippet prints it, which the layout measures; the code itself where
  // `undefined`.
  unmarked?: (code: string) => string;
}

export const printValues: ArgPrinter = {
  show: (_arg, _kind, value) => value,
  unset: () => undefined,
};

interface MarkPrinter extends ArgPrinter {
  // The template of the static `snippet` from its marked print, or `undefined` where the two do not
  // line up, as where a value holds markup the layout reads.
  template(marked: string): SnippetTemplate<AngularHolePlace> | undefined;
}

export const printMarks = (snippet: string): MarkPrinter => {
  const marks = createHoleMarks<AngularHolePlace>([snippet]);
  const read = (marked: string) => {
    const template = marks.toTemplate(marked);
    return template && withUnsetSpace(template);
  };
  return {
    show: (arg, kind, value) => marks.mark({ kind, arg }, value),
    unset: (arg) => marks.mark({ kind: 'prop', arg }, ''),
    unmarked(code) {
      const template = read(code);
      return template ? stripHoles(template) : code;
    },
    template(marked) {
      const template = read(marked);
      if (!template || stripHoles(template) !== snippet) {
        return undefined;
      }
      // A binding a control clears leaves no gap, and text a control clears no empty line.
      return withHoleSpace(template, ({ kind }) => kind === 'prop' || kind === 'text');
    },
  };
};

// The static snippet prints no binding for an input the story does not set, nor the whitespace
// the marked print puts before its empty mark: that whitespace becomes the hole's `space`, which
// the binding a control sets is printed after.
const withUnsetSpace = (
  template: SnippetTemplate<AngularHolePlace>
): SnippetTemplate<AngularHolePlace> => {
  const result: SnippetTemplate<AngularHolePlace> = [];
  for (const segment of template) {
    const previous = result.at(-1);
    const space = typeof previous === 'string' ? /\s*$/.exec(previous)![0] : '';
    if (typeof segment === 'string' || !isUnset(segment) || space === '') {
      result.push(segment);
      continue;
    }
    const before = (previous as string).slice(0, -space.length);
    result.splice(-1, 1, ...(before ? [before] : []), { ...segment, space });
  }
  return result;
};

const isUnset = (hole: TemplateHole<AngularHolePlace>) => hole.kind === 'prop' && hole.text === '';
