import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `buildStoryTemplate`. Besides the shared holes, `⟦element Button⟧` is the
// component with every arg, and `⟦props -children⟧` leaves out the args its words name.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = ''] = words;
    switch (kind) {
      case 'element': {
        const { children, ...props } = args;
        const content = text('children', children);
        const attributes = attributesOf(props);
        return content
          ? `<${first}${attributes}>${content}</${first}>`
          : `<${first}${attributes} />`;
      }
      case 'props': {
        const left = new Set(words.map((word) => word.slice(1)));
        return attributesOf(Object.fromEntries(Object.entries(args).filter(([n]) => !left.has(n))));
      }
      case 'attr':
        return attribute(first, args[second]);
      case 'text':
        return text(first, args[first]);
      default:
        return printValue(args[first], first);
    }
  });

const attributesOf = (args: Args) =>
  Object.entries(args)
    .map(([name, value]) => attribute(name, value))
    .join('');

// A function arg, such as an action, is left out, as no control changes it.
function attribute(name: string, value: unknown): string {
  if (value === undefined || value === null || typeof value === 'function') {
    return '';
  }
  if (!/^[A-Za-z_][\w:-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
  if (value === true) {
    return ` ${name}`;
  }
  // JSX decodes `&` entities in an attribute string, and it cannot hold its own quote.
  return typeof value === 'string' && !/["&]/.test(value)
    ? ` ${name}="${value}"`
    : ` ${name}={${printValue(value, name)}}`;
}

// JSX collapses whitespace in text and reads `{`, `<` and `&` as code.
function text(name: string, value: unknown): string {
  if (value === undefined || value === null || typeof value === 'boolean' || value === '') {
    return '';
  }
  const plain =
    typeof value === 'number' || (typeof value === 'string' && /^\S(.*\S)?$/.test(value));
  return plain && !/[{}<>&]/.test(String(value)) ? String(value) : `{${printValue(value, name)}}`;
}
