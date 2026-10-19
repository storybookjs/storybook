import {
  type FillSnippetTemplate,
  UnprintableArgError,
  asOperand,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';

// Fills a template from `getStoryContentTemplate`. An attribute leaves out an action Storybook adds.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = ''] = words;
    switch (kind) {
      case 'props':
        return spreadArgs(args, words)
          .map(([name, value]) => attribute(name, value))
          .filter(Boolean)
          .join(' ');
      case 'attr':
        return attribute(first, args[second]);
      case 'text':
        return text(first, args[first]);
      case 'operand':
        return asOperand(printValue(args[first], first));
      default:
        return printValue(args[first], first);
    }
  });

function attribute(name: string, value: unknown): string {
  if (value === undefined || isAction(value)) {
    return '';
  }
  if (!/^[A-Za-z_$][\w:$-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
  if (value === true) {
    return name;
  }
  // Svelte reads `{` in an attribute string as code and decodes `&` entities, and the string
  // cannot hold its own quote.
  return typeof value === 'string' && !/["{}&]/.test(value)
    ? `${name}="${value}"`
    : `${name}={${printValue(value, name)}}`;
}

// Svelte collapses whitespace in text and reads `{`, `<` and `&` as code.
function text(name: string, value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const plain =
    typeof value === 'number' || (typeof value === 'string' && /^\S(.*\S)?$/.test(value));
  return plain && !/[{}<>&]/.test(String(value)) ? String(value) : `{${printValue(value, name)}}`;
}
