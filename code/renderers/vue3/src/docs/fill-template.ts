import {
  type FillSnippetTemplate,
  UnprintableArgError,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { isVNode } from 'vue';

// Fills a Vue story template, printing each arg as the static snippet prints the story's own. A
// `⟦value⟧` hole's words say where it stands: `script` in the `<script>`, where no entity is
// decoded, `'` in an attribute value written in single quotes, `{{` in an interpolation, and `.`
// before code that reads on, as in `args.count.toFixed()`. A `"` word prints strings in double
// quotes, as the story writes them, and a `?code` word is the code it prints while the arg is unset.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', ...rest] = words;
    switch (kind) {
      case 'props':
        return spreadArgs(args, words)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([name, arg]) => attribute(name, arg))
          .filter(Boolean)
          .join(' ');
      case 'attr':
        return attribute(first, args[rest[0]!]);
      case 'text':
        return text(first, args[first]);
      case 'value': {
        const unset = args[first] === undefined ? defaultCode(rest.at(-1)) : undefined;
        return unset ?? operand(value(first, args[first], rest), rest.includes('.'));
      }
      default:
        throw new Error(`Unknown hole ⟦${kind}⟧`);
    }
  });

// A value next to code that would read it differently, such as `-1` after `-` or `5` before
// `.toFixed()`, is in parentheses.
const operand = (printed: string, readOn: boolean) =>
  printed.startsWith('-') || (readOn && /^\d/.test(printed)) ? `(${printed})` : printed;

// A string the attribute can hold in one of its quotes is written as is. Vue decodes entities in an
// attribute, so a string with `&` is bound as a literal instead.
function attribute(name: string, arg: unknown): string {
  if (arg === undefined || isAction(arg)) {
    return '';
  }
  checkName(name);
  if (arg === true) {
    return name;
  }
  if (typeof arg === 'string' && !arg.includes('&')) {
    if (!arg.includes('"')) {
      return `${name}="${arg}"`;
    }
    if (!arg.includes("'")) {
      return `${name}='${arg}'`;
    }
  }
  return `:${name}="${value(name, arg)}"`;
}

function checkName(name: string) {
  if (!/^[A-Za-z_][\w:-]*$/.test(name)) {
    throw new UnprintableArgError(name);
  }
}

// Text Vue would read as markup is escaped, and a value that is no text an interpolation.
function text(name: string, arg: unknown): string {
  if (arg === undefined || arg === null || arg === '') {
    return '';
  }
  if (['string', 'number', 'boolean'].includes(typeof arg)) {
    return String(arg)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('{{', '&#123;&#123;');
  }
  return `{{ ${value(name, arg, ['{{'])} }}`;
}

// A literal in an attribute value or an interpolation, both of which decode entities, in an
// attribute in the quote it is not, and `<\/` keeps a string in the `<script>` from ending the
// block. A VNode is a plain object, but no literal renders it. In an interpolation, `}\}` keeps
// a string's `}}` from ending it, and a space other code's, such as `{a:{b:1}}` the story wrote.
function value(name: string, arg: unknown, words: string[] = []) {
  const singleQuoted = words.includes("'");
  const quote = singleQuoted || words.includes('"') ? '"' : "'";
  const printed = printValue(arg, name, { quote, opaque: isVNode });
  if (words.includes('script')) {
    return printed.replaceAll('</', '<\\/');
  }
  if (words.includes('{{')) {
    return printed
      .replace(/}(?=})/g, typeof arg === 'string' ? '}\\' : '} ')
      .replaceAll('&', '&amp;');
  }
  const escaped = printed.replaceAll('&', '&amp;');
  return singleQuoted ? escaped.replaceAll("'", '&#39;') : escaped.replaceAll('"', '&quot;');
}
