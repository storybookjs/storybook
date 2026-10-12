import { fillLitTemplate } from './fill-template-lit.ts';
import { fillAngularTemplate } from './fill-template-angular.ts';
import { fillSnippetTemplate } from './fill-template.ts';
import { fillSvelteTemplate } from './fill-template-svelte.ts';
import { fillVueTemplate } from './fill-template-vue.ts';
import type { StoryDocTemplateSyntax } from './types.ts';

type Filler = (template: string, args: Record<string, unknown>) => string;

/** One filler per template language; each replaces that language's `args` references. */
const fillers: Partial<Record<StoryDocTemplateSyntax, Filler>> = {
  jsx: fillSnippetTemplate,
  svelte: fillSvelteTemplate,
  angular: fillAngularTemplate,
  lit: fillLitTemplate,
  vue: fillVueTemplate,
};

/** Fills a story-docs template with the current args, in the language it was written in. */
export function fillTemplate(
  template: string,
  args: Record<string, unknown>,
  syntax: StoryDocTemplateSyntax = 'jsx'
): string {
  return (fillers[syntax] ?? fillSnippetTemplate)(template, args);
}
