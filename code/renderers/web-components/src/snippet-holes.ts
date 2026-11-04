import type { HoleRef, SnippetTemplate } from 'storybook/internal/docs-tools';

// The places a story-docs snippet prints an arg in, which the story-docs build writes holes for and
// `printHole` prints a changed arg for: in the html of a story without a render, or in the code of a
// story's render function. An attribute `name` or custom `property` is left out where it is the
// arg's own name.
export type HtmlHolePlace =
  // An attribute, or nothing. `render`: the attribute Storybook's render sets; `field`: as that,
  // but `name=""` while empty.
  | { kind: 'attr'; name?: string; mode: 'render' | 'field' }
  // The value as code, in a render function.
  | { kind: 'code' }
  // A declaration in the `style` attribute, and `cssattr` a spread hole for the `style` attribute
  // while the snippet prints none: each property, and the arg that sets it.
  | { kind: 'css'; property?: string }
  | { kind: 'cssattr'; properties: { arg: string; property: string }[] }
  | { kind: 'slot'; name: string }
  // A part or state rule in the `<style>`, and `style` the `<style>` of it alone, with the line
  // break after it.
  | { kind: 'rule'; selector: string }
  | { kind: 'style'; selector: string }
  // A spread hole after the snippet for the properties without an attribute, which only a script
  // sets: each one's element, and the arg it is set to.
  | { kind: 'props'; properties: SnippetProperty[] }
  // An arg the template reads where the snippet cannot follow it.
  | { kind: 'guard' };

// A property without an attribute: `tag`'s property `name`, set to the arg `arg`.
export interface SnippetProperty {
  arg: string;
  name: string;
  tag: string;
}

export type HtmlHole = HoleRef<HtmlHolePlace>;

// An `attr` hole for the attribute `name`, which it leaves out where that is the arg it reads.
export const attrHole = (
  arg: string,
  name: string,
  mode: Extract<HtmlHolePlace, { kind: 'attr' }>['mode']
): HtmlHole => ({ kind: 'attr', arg, ...(name !== arg && { name }), mode });

export type HtmlSnippetTemplate = SnippetTemplate<HtmlHolePlace>;
