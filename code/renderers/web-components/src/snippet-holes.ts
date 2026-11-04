import type { HoleRef, SnippetTemplate } from 'storybook/internal/docs-tools';

// The places a story-docs snippet prints an arg in html, which the story-docs build writes holes
// for and `printHole` prints a changed arg for. An attribute `name` or custom `property` is left
// out where it is the arg's own name.
export type HtmlHolePlace =
  // An attribute, or nothing. `render`: the attribute Storybook's render sets; `field`: as that,
  // but `name=""` while empty; `bind`: lit's `name=${arg}`; `defined`: lit's
  // `name=${ifDefined(arg)}`, left out while unset.
  | { kind: 'attr'; name?: string; mode: 'render' | 'field' | 'bind' | 'defined' }
  // Lit's `?name=${arg}`.
  | { kind: 'bool'; name?: string }
  // Text in a quoted attribute value.
  | { kind: 'quoted' }
  // A custom property in the `style` attribute, and `cssattr` the `style` attribute of it alone.
  | { kind: 'css'; property?: string }
  | { kind: 'cssattr'; property?: string }
  // The text of a lit template, trimmed where the snippet prints a text node trimmed.
  | { kind: 'text'; trimStart: boolean; trimEnd: boolean }
  // The html of a string template.
  | { kind: 'html' }
  | { kind: 'slot'; name: string }
  // A part or state rule in the `<style>`, and `style` the `<style>` of it alone, with the line
  // break after it.
  | { kind: 'rule'; selector: string }
  | { kind: 'style'; selector: string }
  // An arg the template reads where the snippet cannot follow it.
  | { kind: 'guard' };

export type HtmlHole = HoleRef<HtmlHolePlace>;

// An `attr` hole for the attribute `name`, which it leaves out where that is `arg`.
export const attrHole = (
  arg: string,
  name: string,
  mode: Extract<HtmlHolePlace, { kind: 'attr' }>['mode']
): HtmlHole => ({ kind: 'attr', arg, ...(name !== arg && { name }), mode });

export type HtmlSnippetTemplate = SnippetTemplate<HtmlHolePlace>;
