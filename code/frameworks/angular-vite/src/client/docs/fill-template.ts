import { type FillSnippetTemplate, UnprintableArgError } from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import {
  FIELD_MARKER,
  HANDLER_MARKER,
  MARKUP_MARKER,
  type TemplateItem,
  parseItems,
} from '../../snippet-markers.ts';
import {
  type TemplateInputBinding,
  buildTemplate,
  escapeAttributeExpression,
  formatInputBinding,
  formatOutputBinding,
  formatOutputHandler,
  formatPropInTemplate,
  formatTemplateMarkup,
  printTemplateData,
  splitHostComponentTemplate,
  toTemplateLiteral,
} from '../../template-grammar.ts';

// Fills a story-docs template (see `snippet-markers.ts`) with the current args, in one pass per
// marker kind over each part of the host component, so a filled-in value is never read as a marker.
// An arg it cannot write as the code the story runs throws, and the preview shows the static snippet,
// warning included, instead.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const { before, template: markup, after } = splitHostComponentTemplate(template)!;
  return (
    fillFields(before, args) +
    toTemplateLiteral(fillMarkup(markup, args)) +
    fillFields(fillHandlers(after, args), args)
  );
};

const fillFields = (code: string, args: Args) =>
  code.replace(FIELD_MARKER, (_match, name: string) => printArg(name, args[name]));

const fillHandlers = (code: string, args: Args) =>
  code
    .replace(HANDLER_MARKER, (_match, name: string) =>
      isBoundOutput(args[name]) ? `\n  ${formatOutputHandler(name)}` : ''
    )
    .replace(/ \{\n\}$/, ' {}');

function fillMarkup(markup: string, args: Args): string {
  let element: string | undefined;
  const filled = markup.replace(MARKUP_MARKER, (...match) => {
    const groups = match.at(-1) as Record<string, string | undefined>;
    if (groups.selector !== undefined) {
      const items = parseItems(groups.elementItems!);
      element = buildTemplate(groups.selector, {
        inputs: inputsOf(items, args),
        outputs: outputsOf(items),
        selfClosing: true,
      });
      return element;
    }
    if (groups.text !== undefined) {
      return String(args[groups.text]);
    }
    const items = parseItems(groups.bindingItems!);
    const bindings = [
      ...inputsOf(items, args).map(formatInputBinding),
      ...outputsOf(items)
        .filter((name) => isBoundOutput(args[name]))
        .map(formatOutputBinding),
    ];
    return bindings.length === 0 ? '' : `${groups.space}${bindings.join(' ')}`;
  });
  return element ?? formatTemplateMarkup(filled);
}

// Data longer than this reads better by the name the static snippet gives it.
const MAX_DATA_LENGTH = 500;

const printArg = (name: string, value: unknown): string => {
  const printed = printTemplateData(value);
  if (
    printed === undefined ||
    (typeof value === 'object' && value !== null && printed.length > MAX_DATA_LENGTH)
  ) {
    throw new UnprintableArgError(name);
  }
  return printed;
};

const isBoundOutput = (value: unknown) => typeof value === 'function';

// An unset input is left out, as the static snippet leaves it out.
const inputsOf = (items: readonly TemplateItem[], args: Args): TemplateInputBinding[] =>
  items.flatMap(({ kind, name }) => {
    if (kind === 'field') {
      return [{ name, expression: formatPropInTemplate(name) }];
    }
    if (kind !== 'input' || args[name] === undefined) {
      return [];
    }
    return [{ name, expression: escapeAttributeExpression(printArg(name, args[name])) }];
  });

const outputsOf = (items: readonly TemplateItem[]) =>
  items.flatMap(({ kind, name }) => (kind === 'output' ? [name] : []));
