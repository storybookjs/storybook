import { type FillSnippetTemplate, fillHoles, printValue } from 'storybook/internal/docs-tools';

import { escapeTemplateLiteral } from '../../template-grammar.ts';

// Fills a template from the story-docs build. Its only hole is `⟦props label size⟧`, the inputs
// the story's args may bind, which lands in the host component's `template` literal.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (_kind, inputs) =>
    inputs.map((name) => escapeTemplateLiteral(binding(name, args[name]))).join('')
  );

// A function arg, such as an action, is left out, as no control changes it; the snippet binds an
// output to a host method of its own.
function binding(name: string, value: unknown): string {
  if (value === undefined || typeof value === 'function') {
    return '';
  }
  // Angular reads `{{` in a plain attribute as an interpolation.
  return typeof value === 'string' && !value.includes('{{')
    ? ` ${name}="${escapeAttribute(value)}"`
    : ` [${name}]="${escapeAttribute(printValue(value, name, { quote: "'", opaque: isNonFinite }))}"`;
}

const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// An Angular template has no `NaN` or `Infinity`; it would read them as component fields.
const isNonFinite = (value: unknown) => typeof value === 'number' && !Number.isFinite(value);
