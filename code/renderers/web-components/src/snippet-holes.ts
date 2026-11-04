import type { HoleRef, SnippetTemplate } from 'storybook/internal/docs-tools';

// The places a story-docs snippet prints an arg in html, which the story-docs build writes holes
// for and `printHole` prints a changed arg for. An attribute `name` or custom `property` is left
// out where it is the arg's own name. A `path` reads a member of the arg, as `args.user.name` does.
export type HtmlHolePlace = Place & { path?: string[] };

type Place =
  // An attribute, or nothing. `render`: the attribute Storybook's render sets; `field`: as that,
  // but `name=""` while empty; `bind`: lit's `name=${arg}`; `defined`: lit's
  // `name=${ifDefined(arg)}`, left out while unset.
  | { kind: 'attr'; name?: string; mode: 'render' | 'field' | 'bind' | 'defined' }
  // Lit's `?name=${arg}`.
  | { kind: 'bool'; name?: string }
  // Text in a quoted attribute value.
  | { kind: 'quoted' }
  // A custom property in the `style` attribute, and `cssattr` a spread hole for the `style`
  // attribute while the snippet prints none: each custom property, and the arg that sets it.
  | { kind: 'css'; property?: string }
  | { kind: 'cssattr'; properties: { arg: string; property: string }[] }
  // The text of a lit template.
  | { kind: 'text' }
  // The html of a string template.
  | { kind: 'html' }
  | { kind: 'slot'; name: string }
  // A part or state rule in the `<style>`, and `style` the `<style>` of it alone, with the line
  // break after it.
  | { kind: 'rule'; selector: string }
  | { kind: 'style'; selector: string }
  // `${arg ? a : b}` where neither branch reads an arg: what the snippet prints for each branch.
  | { kind: 'choice'; truthy: string; falsy: string }
  // A spread hole after the snippet for the properties without an attribute, which only a script
  // sets: each one's element, and the arg it is set to.
  | { kind: 'props'; properties: SnippetProperty[] }
  // An arg the template reads where the snippet cannot follow it.
  | { kind: 'guard' };

// A property without an attribute: `tag`'s property `name`, set to the arg `arg` (at `path`).
export interface SnippetProperty extends ArgRead {
  name: string;
  tag: string;
}

// What a hole reads: an arg, or the member of it at `path`.
export interface ArgRead {
  arg: string;
  path?: string[];
}

export type HtmlHole = HoleRef<HtmlHolePlace>;

// An `attr` hole for the attribute `name`, which it leaves out where that is the arg it reads.
export const attrHole = (
  { arg, path }: ArgRead,
  name: string,
  mode: Extract<HtmlHolePlace, { kind: 'attr' }>['mode']
): HtmlHole => ({ kind: 'attr', arg, ...(path && { path }), ...(name !== arg && { name }), mode });

export type HtmlSnippetTemplate = SnippetTemplate<HtmlHolePlace>;
