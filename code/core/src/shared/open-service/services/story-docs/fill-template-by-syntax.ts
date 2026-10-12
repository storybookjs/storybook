import { fillSnippetTemplate } from './fill-template.ts';
import type { StoryDocTemplateSyntax } from './types.ts';

type Filler = (template: string, args: Record<string, unknown>) => string;

/** One filler per template language; each replaces that language's `args` references. */
const fillers: Partial<Record<StoryDocTemplateSyntax, Filler>> = {
  jsx: fillSnippetTemplate,
};

/** Fills a story-docs template with the current args, in the language it was written in. */
export function fillTemplate(
  template: string,
  args: Record<string, unknown>,
  syntax: StoryDocTemplateSyntax = 'jsx'
): string {
  return (fillers[syntax] ?? fillSnippetTemplate)(template, args);
}
