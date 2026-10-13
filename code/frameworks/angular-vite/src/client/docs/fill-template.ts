import { type FillSnippetTemplate, fillHoles, printValue } from 'storybook/internal/docs-tools';

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
    : ` [${name}]="${escapeAttribute(printValue(value, name, "'"))}"`;
}

const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// The template sits in a template literal, so what would end or escape it is escaped.
const escapeTemplateLiteral = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
