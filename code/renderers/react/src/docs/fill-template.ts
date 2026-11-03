import {
  type FillSnippetTemplate,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

// Fills a template from `getCodeSnippet`, printing each hole as its printer prints that arg, so the
// template filled with the story's own args is its static snippet. Besides the shared holes,
// `⟦element Button⟧` is the component with every arg and `⟦args⟧` the args as an object, both
// without their `-name` words, and `⟦close Button ?code⟧` ends an element whose children a spread
// passes, with them as content indented as its `^indent` word, or as the story writes it, `code`,
// without. A `?code` word is the code a hole prints, as written, while its arg is unset.
// A value that prints more than one line is indented as the line its hole is on.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  const lines = [...template.matchAll(/⟦[^⟧]*⟧/g)].map(({ index }) =>
    template.slice(template.lastIndexOf('\n', index) + 1, index)
  );
  let hole = 0;
  return fillHoles(template, (kind, words) => {
    const line = lines[hole++]!;
    const printed = fill(kind, words, args);
    return typeof printed === 'string' ? indent(printed, /^\s*/.exec(line)![0]) : printed.code;
  });
};

// Code a hole prints as it is, already indented as the snippet has it.
type Written = { code: string };

const indent = (code: string, prefix: string) => {
  let literal = false;
  let text = '';
  for (let index = 0; index < code.length; index++) {
    const char = code[index]!;
    text += char;
    if (char === '\\') {
      text += code[++index] ?? '';
    } else if (char === '`') {
      literal = !literal;
    } else if (char === '\n' && !literal && /./.test(code[index + 1] ?? '')) {
      text += prefix;
    }
  }
  return text;
};

function fill(kind: string, words: string[], args: Args): string | Written {
  const [first = '', second = ''] = words;
  // Only an arg's own value: a name every object inherits, such as `constructor`, is no arg.
  const arg = (name: string) => (Object.hasOwn(args, name) ? args[name] : undefined);
  const unset = (name: string) => {
    const code = arg(name) === undefined ? defaultCode(words.at(-1)) : undefined;
    return code === undefined ? undefined : { code };
  };
  switch (kind) {
    case 'element': {
      const { children, ...props } = Object.fromEntries(spreadArgs(args, words.slice(1)));
      return element(first, attributesOf(props), text('children', children));
    }
    case 'close': {
      if (arg('children') === undefined) {
        return { code: defaultCode(words.at(-1)) ?? ' />' };
      }
      const prefix = words.find((word) => word.startsWith('^'))?.slice(1) ?? '';
      return { code: `>${indent(text('children', arg('children')), prefix)}</${first}>` };
    }
    case 'props':
      return attributesOf(Object.fromEntries(spreadArgs(args, words))).join(' ');
    case 'args':
      return boundArgs(spreadArgs(args, words));
    case 'attr':
      return unset(second) ?? attribute(first, arg(second));
    case 'text':
      return unset(first) ?? text(first, arg(first));
    default:
      throw new Error(`Unknown hole ⟦${kind}⟧`);
  }
}

// The element on one line, as the printer writes it.
function element(name: string, attributes: string[], content: string) {
  const open = [name, ...attributes].join(' ');
  return content ? `<${open}>${content}</${name}>` : `<${open} />`;
}

// The args a bound story is called with, one a line, as the printer writes them.
function boundArgs(entries: [string, unknown][]) {
  const properties = entries
    .filter(([, value]) => value !== undefined && !isAction(value))
    .map(
      ([name, value]) => `    ${JSON.stringify(name)}: ${indent(printValue(value, name), '    ')}`
    );
  return properties.length === 0 ? '{}' : `{\n${properties.join(',\n')}\n}`;
}

// An arg whose name no attribute can have goes in a spread after the attributes, as the printed
// snippet has it: `{...{ "my label": "Go" }}`.
function attributesOf(args: Args) {
  const entries = Object.entries(args);
  const unnamed = entries.filter(([name]) => !/^[A-Za-z_][\w:-]*$/.test(name));
  const spread = object(unnamed);
  return [
    ...entries
      .filter((entry) => !unnamed.includes(entry))
      .map(([name, value]) => attribute(name, value)),
    spread === '{}' ? '' : `{...${spread}}`,
  ].filter(Boolean);
}

function attribute(name: string, value: unknown): string {
  if (value === undefined || isAction(value)) {
    return '';
  }
  if (value === true) {
    return name;
  }
  // JSX decodes `&` entities in an attribute string, and it cannot hold its own quote. A line break
  // would take the indentation of the line it is on.
  return typeof value === 'string' && !/["&\n\r]/.test(value)
    ? `${name}="${value}"`
    : `${name}={${printValue(value, name)}}`;
}

const object = (entries: [string, unknown][]) => {
  const properties = entries
    .filter(([, value]) => value !== undefined && !isAction(value))
    .map(([name, value]) => `${JSON.stringify(name)}: ${printValue(value, name)}`);
  return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`;
};

// Content as the printer writes it: a string JSX text can hold as it is, and any other value as an
// expression, as JSX reads `{`, `<` and `&` in text as code and folds line breaks.
function text(name: string, value: unknown): string {
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'string' && !/[{}<>&\r\n]/.test(value)) {
    return value;
  }
  // JSX the story writes as an arg is content as it is.
  const printed = printValue(value, name);
  return printed.startsWith('<') ? printed : `{${printed}}`;
}
