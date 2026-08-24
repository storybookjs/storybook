// Imported by the dev-server story-docs provider and by the preview, so this module must stay free
// of `@angular/core` and of any other runtime-only import.
import { escapeAttributeExpression, printArgExpression } from './arg-expression.ts';
import { buildHostComponentSnippet } from './host-component-snippet.ts';
import type { TemplateInputBinding } from './template-grammar.ts';
import { buildTemplate } from './template-grammar.ts';

export const SNIPPET_TEMPLATE_KIND = 'angular-snippet-template';

export interface StorySnippetTemplate {
  kind: typeof SNIPPET_TEMPLATE_KIND;
  selector: string;
  inputNames: string[];
  outputs: string[];
  componentName: string;
  componentImport?: string;
  standalone: boolean;
  ngModules?: { names: string[]; importStatements: string[] };
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNgModules = (value: unknown): value is NonNullable<StorySnippetTemplate['ngModules']> =>
  typeof value === 'object' &&
  value !== null &&
  isStringArray((value as { names?: unknown }).names) &&
  isStringArray((value as { importStatements?: unknown }).importStatements);

export const isStorySnippetTemplate = (value: unknown): value is StorySnippetTemplate => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const template = value as Partial<Record<keyof StorySnippetTemplate, unknown>>;
  return (
    template.kind === SNIPPET_TEMPLATE_KIND &&
    typeof template.selector === 'string' &&
    isStringArray(template.inputNames) &&
    isStringArray(template.outputs) &&
    typeof template.componentName === 'string' &&
    (template.componentImport === undefined || typeof template.componentImport === 'string') &&
    typeof template.standalone === 'boolean' &&
    (template.ngModules === undefined || isNgModules(template.ngModules))
  );
};

export const renderSnippetFromTemplate = (
  snippetTemplate: unknown,
  args: Record<string, unknown>
): string | undefined => {
  if (!isStorySnippetTemplate(snippetTemplate)) {
    return undefined;
  }

  const inputs: TemplateInputBinding[] = [];
  for (const name of snippetTemplate.inputNames) {
    if (!Object.hasOwn(args, name) || args[name] === undefined) {
      continue;
    }
    const expression = printArgExpression(args[name]);
    if (expression === undefined) {
      return undefined;
    }
    inputs.push({ name, expression: escapeAttributeExpression(expression) });
  }

  return buildHostComponentSnippet({
    template: buildTemplate(snippetTemplate.selector, {
      inputs,
      outputs: snippetTemplate.outputs,
      style: 'snippet',
    }),
    componentName: snippetTemplate.componentName,
    componentImport: snippetTemplate.componentImport,
    standalone: snippetTemplate.standalone,
    ngModules: snippetTemplate.ngModules,
    outputs: snippetTemplate.outputs,
    viaComponentOutlet: false,
  }).snippet;
};
