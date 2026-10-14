import {
  type FillSnippetTemplate,
  UnprintableArgError,
  asOperand,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `buildStoryTemplate`. Besides the shared holes, `⟦element Button⟧` is the
// component with every arg and `⟦args⟧` the args as an object, both without their `-name` words,
// and `⟦close Button⟧` ends a self-closing element whose children a spread passes, with them as
// content.
// A hole for one arg may end in a default word, the code that stands for the arg while it is unset.
// A hole that prints more than one line is indented as the line it is on.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const lines = [...template.matchAll(/⟦[^⟧]*⟧/g)].map(({ index }) =>
    template.slice(template.lastIndexOf('\n', index) + 1, index)
  );
  let hole = 0;
  return fillHoles(template, (kind, words) => {
    const line = lines[hole++]!;
    return indent(fill(kind, words, args, !line.trim()), /^\s*/.exec(line)![0]);
  });
};

const indent = (code: string, prefix: string) => code.replace(/\n(?=.)/g, `\n${prefix}`);

function fill(kind: string, words: string[], args: Args, ownLine: boolean): string {
  const [first = '', second = ''] = words;
  const at = kind === 'attr' ? 2 : 1;
  const unset = args[words[at - 1]!] === undefined && defaultCode(words[at]);
  switch (kind) {
    case 'element': {
      const { children, ...props } = Object.fromEntries(spreadArgs(args, words.slice(1)));
      return element(first, attributesOf(props), text('children', children));
    }
    case 'close': {
      const content = text('children', args.children);
      return content ? `>${content}</${first}>` : ownLine ? '/>' : ' />';
    }
    case 'props':
      return attributesOf(Object.fromEntries(spreadArgs(args, words))).join(ownLine ? '\n' : ' ');
    case 'args':
      return object(spreadArgs(args, words));
    case 'attr':
      return unset ? `${first}={${unset}}` : attribute(first, args[second]);
    case 'text':
      return unset ? `{${unset}}` : text(first, args[first]);
    case 'operand':
      return unset || asOperand(printValue(args[first], first));
    default:
      return unset || printValue(args[first], first);
  }
}

// One attribute a line once the element is long, or one of them is more than a line.
function element(name: string, attributes: string[], content: string) {
  const long = [name, ...attributes].join(' ').length > 80 || attributes.join('').includes('\n');
  const open = long
    ? `${name}${attributes.map((attribute) => `\n  ${indent(attribute, '  ')}`).join('')}\n`
    : [name, ...attributes].join(' ');
  return content ? `<${open}>${content}</${name}>` : `<${open}${long ? '' : ' '}/>`;
}

const attributesOf = (args: Args) =>
  Object.entries(args)
    .map(([name, value]) => attribute(name, value))
    .filter(Boolean);

function attribute(name: string, value: unknown): string {
  if (value === undefined || isAction(value)) {
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
    : `${name}={${printValue(value, name)}}`;
}

const object = (entries: [string, unknown][]) => {
  const properties = entries
    .filter(([, value]) => value !== undefined && !isAction(value))
    .map(
      ([name, value]) =>
        `${/^[A-Za-z_$][\w$]*$/.test(name) ? name : printValue(name, name)}: ${printValue(value, name)}`
    );
  return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`;
};

// JSX collapses whitespace in text and reads `{`, `<` and `&` as code.
function text(name: string, value: unknown): string {
  if (value === undefined || value === null || typeof value === 'boolean' || value === '') {
    return '';
  }
  const plain =
    typeof value === 'number' || (typeof value === 'string' && /^\S(.*\S)?$/.test(value));
  return plain && !/[{}<>&]/.test(String(value)) ? String(value) : `{${printValue(value, name)}}`;
}
