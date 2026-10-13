import {
  type FillSnippetTemplate,
  UnprintableArgError,
  asOperand,
  fillHoles,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `buildStoryTemplate`. Besides the shared holes, `⟦element Button⟧` is the
// component with every arg.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', second = ''] = words;
    switch (kind) {
      case 'element': {
        const { children, ...props } = args;
        const content = text('children', children);
        const open = [first, attributesOf(props)].filter(Boolean).join(' ');
        return content ? `<${open}>${content}</${first}>` : `<${open} />`;
      }
      case 'props':
        return attributesOf(Object.fromEntries(spreadArgs(args, words)));
      case 'attr':
        return attribute(first, args[second]);
      case 'text':
        return text(first, args[first]);
      case 'operand':
        return asOperand(literal(first, args[first]));
      default:
        return literal(first, args[first]);
    }
  });

const attributesOf = (args: Args) =>
  Object.entries(args)
    .map(([name, value]) => attribute(name, value))
    .filter(Boolean)
    .join(' ');

// A component arg, such as an icon, is written by its name. Any other function arg, such as an
// action, is left out, as no control changes it.
function attribute(name: string, value: unknown): string {
  const component = componentName(value);
  if (value === undefined || value === null || (typeof value === 'function' && !component)) {
    return '';
  }
  if (!/^[A-Za-z_][\w:-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
  if (value === true) {
    return name;
  }
  // JSX decodes `&` entities in an attribute string, and it cannot hold its own quote.
  return typeof value === 'string' && !/["&]/.test(value)
    ? `${name}="${value}"`
    : `${name}={${component ?? printValue(value, name)}}`;
}

const literal = (name: string, value: unknown) => componentName(value) ?? printValue(value, name);

// A function named like a component, which a mock such as `fn()` never is.
const componentName = (value: unknown) =>
  typeof value === 'function' && !('getMockName' in value) && /^[A-Z][\w$]*$/.test(value.name)
    ? value.name
    : undefined;

// JSX collapses whitespace in text and reads `{`, `<` and `&` as code.
function text(name: string, value: unknown): string {
  if (value === undefined || value === null || typeof value === 'boolean' || value === '') {
    return '';
  }
  const plain =
    typeof value === 'number' || (typeof value === 'string' && /^\S(.*\S)?$/.test(value));
  return plain && !/[{}<>&]/.test(String(value)) ? String(value) : `{${printValue(value, name)}}`;
}
