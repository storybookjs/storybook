// Rebuilds a story's snippet from the template the server emitted for it and the args a reader is
// looking at. Imported by the dev-server story-docs provider and by the preview, so this module
// must stay free of `@angular/core` and of any other runtime-only import.
import { escapeAttributeExpression, printArgExpression } from './arg-expression.ts';
import type { HostComponentSnippetInput } from './host-component-snippet.ts';
import { buildHostComponentSnippet } from './host-component-snippet.ts';
import type { TagClose } from './template-grammar.ts';
import { layoutTag } from './template-grammar.ts';

/** Identifies a template this framework wrote, across a version skew a static build can carry. */
export const SNIPPET_TEMPLATE_KIND = 'angular-snippet-template';

/**
 * Everything needed to rebuild a story's snippet without its source file.
 */
export interface StorySnippetTemplate extends Omit<
  HostComponentSnippetInput,
  'viaComponentOutlet' | 'fields'
> {
  kind: typeof SNIPPET_TEMPLATE_KIND;
  /**
   * The story's tag in wire form: the open line, one binding per line, and the tag's end last, with
   * `[name]="{{name}}"` standing in for every input the component declares.
   *
   * Every declared input is a hole, not just the ones the story set: a reader can turn any of the
   * others on from the Controls panel, and a template that already carries them places such a
   * binding where the component declares it rather than appending it wherever it was switched on.
   */
  template: string;
}

export const isStorySnippetTemplate = (value: unknown): value is StorySnippetTemplate =>
  typeof value === 'object' &&
  value !== null &&
  (value as { kind?: unknown }).kind === SNIPPET_TEMPLATE_KIND;

// A binding whose whole attribute value is its own hole. The name is matched by backreference, so
// it needs no escaping and an input cannot be confused with one whose name it is a prefix of.
const HOLE = /^\[([^\]]+)\]="\{\{\1\}\}"$/;

const DECLINED = Symbol('snippet-template-declined');

/** The binding for one wire-form line: filled, dropped (`undefined`), or unprintable. */
const fillBinding = (
  binding: string,
  args: Record<string, unknown>
): string | undefined | typeof DECLINED => {
  const hole = HOLE.exec(binding);
  if (!hole) {
    // An output binding carries a handler name rather than a value, so it is never substituted.
    return binding;
  }
  const name = hole[1];
  // The args ARE the truth, and resetting a control drops the key rather than setting it to
  // `undefined`, so absence is what removes a binding.
  if (!(name in args) || args[name] === undefined) {
    return undefined;
  }
  const printed = printArgExpression(args[name]);
  if (printed === undefined) {
    return DECLINED;
  }
  return `[${name}]="${escapeAttributeExpression(printed)}"`;
};

/**
 * The story's snippet for the args in front of the reader, or `undefined` to decline the rebuild.
 */
export const renderSnippetFromTemplate = (
  snippetTemplate: unknown,
  args: Record<string, unknown>
): string | undefined => {
  if (!isStorySnippetTemplate(snippetTemplate)) {
    return undefined;
  }
  const lines = snippetTemplate.template.split('\n');
  const end = lines.at(-1)!;
  const bindings: string[] = [];

  for (const line of lines.slice(1, -1)) {
    const filled = fillBinding(line.trim(), args);
    if (filled === DECLINED) {
      return undefined;
    }
    if (filled !== undefined) {
      bindings.push(filled);
    }
  }

  const close: TagClose =
    end === '/>' ? { selfClosing: true } : { selfClosing: false, tag: end.slice(2, -1), inner: '' };

  return buildHostComponentSnippet({
    ...snippetTemplate,
    template: layoutTag({ open: lines[0]!, bindings, close, style: 'snippet' }),
    // The outlet path shows no args at all, so it never carries a template; the authored-markup
    // path owns `fields`, and it never carries one either.
    viaComponentOutlet: false,
  }).snippet;
};
