import {
  type FillSnippetTemplate,
  defaultCode,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';

import { escapeTemplateLiteral } from '../../template-grammar.ts';

// Fills a template from the story-docs build. `⟦props label size⟧` is the inputs the story's args
// may bind, which lands in the host component's `template` literal. `⟦value label⟧` is the value
// of a host field, for an arg the markup reads by name; its default word is printed while unset.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) =>
    kind === 'value'
      ? (args[words[0]!] === undefined && defaultCode(words[1])) ||
        fieldValue(args[words[0]!], words[0]!)
      : words
          .map((name) => escapeTemplateLiteral(binding(name, args[name])))
          .filter(Boolean)
          .join(' ')
  );

// A host field is TypeScript, which can hold a date an Angular template has no literal for.
const fieldValue = (value: unknown, name: string) =>
  value instanceof Date && !Number.isNaN(value.getTime())
    ? `new Date('${value.toISOString()}')`
    : printValue(value, name, { quote: "'" });

// A function arg, such as an action, is left out, as no control changes it; the snippet binds an
// output to a host method of its own.
function binding(name: string, value: unknown): string {
  if (value === undefined || typeof value === 'function') {
    return '';
  }
  // Angular reads `{{` in a plain attribute as an interpolation.
  return typeof value === 'string' && !value.includes('{{')
    ? `${name}="${escapeAttribute(value)}"`
    : `[${name}]="${escapeAttribute(printValue(value, name, { quote: "'", opaque: isNonFinite }))}"`;
}

const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// An Angular template has no `NaN` or `Infinity`; it would read them as component fields.
const isNonFinite = (value: unknown) => typeof value === 'number' && !Number.isFinite(value);
