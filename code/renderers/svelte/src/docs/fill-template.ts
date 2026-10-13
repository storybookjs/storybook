import {
  type FillSnippetTemplate,
  UnprintableArgError,
  fillHoles,
  printValue,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `getStoryContentTemplate`. `⟦props -children⟧` leaves out the args its
// words name, as the element writes them itself.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = ''] = words;
    switch (kind) {
      case 'props': {
        const left = new Set(words.map((word) => word.slice(1)));
        return Object.entries(args)
          .filter(([name]) => !left.has(name))
          .map(([name, value]) => attribute(name, value))
          .join('');
      }
      case 'attr':
        return attribute(first, args[second]);
      case 'text':
        return text(first, args[first]);
      default:
        return literal(first, args[first]);
    }
  });

function attribute(name: string, value: Args[string]): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (!/^[A-Za-z_$][\w:$-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
  if (value === true) {
    return ` ${name}`;
  }
  // Svelte reads `{` in an attribute string as code and decodes `&` entities, and the string
  // cannot hold its own quote.
  return typeof value === 'string' && !/["{}&]/.test(value)
    ? ` ${name}="${value}"`
    : ` ${name}={${literal(name, value)}}`;
}

// Svelte collapses whitespace in text and reads `{`, `<` and `&` as code.
function text(name: string, value: Args[string]): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const plain =
    typeof value === 'number' || (typeof value === 'string' && /^\S(.*\S)?$/.test(value));
  return plain && !/[{}<>&]/.test(String(value)) ? String(value) : `{${literal(name, value)}}`;
}

// The story's only snippet is this one, so a function, such as an action, shows as its name, and
// a date as the code that makes it.
function literal(name: string, value: unknown): string {
  if (value instanceof Date) {
    return `new Date(${printValue(value.toISOString(), name)})`;
  }
  if (typeof value !== 'function') {
    return printValue(value, name);
  }
  const fnName = (value as { getMockName?: () => string }).getMockName?.() ?? value.name;
  return fnName && fnName !== 'spy' && /^[A-Za-z_$][\w$]*$/.test(fnName) ? fnName : '() => {}';
}
