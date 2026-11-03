import {
  type FillSnippetTemplate,
  UnprintableArgError,
  defaultCode,
  fillHoles,
  isAction,
  printValue,
  spreadArgs,
  writtenCode,
} from 'storybook/internal/docs-tools';

import { isVNode } from 'vue';

import {
  type SnippetValue,
  attributeOrder,
  expressionCode,
  fitsBraces,
  interpolatedText,
  operand,
  printAttribute,
  slotContent,
} from '../snippet-values.ts';

// Fills a template of the Vue story-docs provider, printing each hole's value with the printers the
// static snippet is printed with, as its words state:
// - `⟦attr name arg⟧`: the attribute `name`, left out while the arg is unset.
// - `⟦props -name…⟧`: the args an args binding passes, but those the words name, in name order.
// - `⟦text arg⟧`: the text of an interpolation, with `{<` and `{>` for a `{` the template writes
//   before or after it; with `slot`, a slot's content; `=text` is the text while the arg holds the
//   value the story writes.
// - `⟦value arg⟧`: code in a template expression, in an attribute quoted with `'` (a `'` word) or
//   `"`, or in an interpolation (`{{`); with `script`, in `<script setup>`. `op` puts it in
//   parentheses where the code around it reads it otherwise, as after a `.` word; a `"` word quotes
//   strings in `"`, as the story does; `?code` is the code while the arg is unset.
export const fillTemplate: FillSnippetTemplate = (template, args) =>
  fillHoles(template, (kind, words) => {
    const [first = '', ...rest] = words;
    const arg = (name: string) => (Object.hasOwn(args, name) ? args[name] : undefined);
    switch (kind) {
      case 'props':
        return spreadArgs(args, words)
          .filter(([, value]) => value !== undefined && !isAction(value))
          .sort(([a], [b]) => attributeOrder(a, b))
          .map(([name, value]) => attribute(name, value))
          .join(' ');
      case 'attr': {
        const value = arg(rest[0]!);
        return value === undefined || isAction(value) ? '' : attribute(first, value);
      }
      case 'text':
        return text(first, arg(first), rest);
      case 'value': {
        const value = arg(first);
        const unset =
          value === undefined ? defaultCode(rest.find((w) => w.startsWith('?'))) : undefined;
        if (unset !== undefined) {
          return unset;
        }
        const code = rest.includes('script')
          ? scriptCode(first, value, rest)
          : expression(first, value, rest);
        return rest.includes('op') ? operand(code, rest.includes('.')) : code;
      }
      default:
        throw new Error(`Unknown hole ⟦${kind}⟧`);
    }
  });

// A value as the snippet prints it there, if the story wrote its literal: a boolean, string or
// number literal, or code, which a negative number and `null` are. Anything else the snippet
// declares in `<script setup>`, which a hole cannot.
function snippetValue(name: string, value: unknown): SnippetValue {
  const code = writtenCode(value);
  if (code !== undefined) {
    return { kind: 'code', code };
  }
  if (typeof value === 'boolean') {
    return { kind: 'boolean', value };
  }
  if (typeof value === 'string') {
    return { kind: 'string', value };
  }
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) {
    return value < 0
      ? { kind: 'code', code: String(value) }
      : { kind: 'number', value, code: String(value) };
  }
  if (value === null) {
    return { kind: 'code', code: 'null' };
  }
  throw new UnprintableArgError(name);
}

function attribute(name: string, value: unknown): string {
  const printed = printAttribute(name, snippetValue(name, value));
  if (printed === undefined) {
    throw new UnprintableArgError(name);
  }
  return printed;
}

function text(name: string, value: unknown, words: string[]): string {
  if (value === undefined || value === '') {
    return '';
  }
  const written = words.find((word) => word.startsWith('='));
  if (written !== undefined && writtenCode(value) !== undefined) {
    return written.slice(1);
  }
  const printed = snippetValue(name, value);
  const content = words.includes('slot') ? slotContent(printed) : interpolatedText(printed);
  if (content === undefined || !fitsBraces(content, words)) {
    throw new UnprintableArgError(name);
  }
  return content;
}

// Code in `<script setup>`: any literal, in the quotes the story writes strings in.
function scriptCode(name: string, value: unknown, words: string[]): string {
  return printValue(value, name, { quote: words.includes('"') ? '"' : "'", opaque: isVNode });
}

// Code in a template expression: a value the snippet prints there, as a literal in the quote the
// attribute is not.
function expression(name: string, value: unknown, words: string[]): string {
  const quote = words.includes("'") ? "'" : words.includes('{{') ? undefined : '"';
  const code =
    value === undefined
      ? 'undefined'
      : (() => {
          const printed = snippetValue(name, value);
          return printed.kind === 'code'
            ? printed.code
            : printValue(printed.value, name, {
                quote: quote === "'" || words.includes('"') ? '"' : "'",
              });
        })();
  const fits = expressionCode(code, quote);
  if (fits === undefined) {
    throw new UnprintableArgError(name);
  }
  return fits;
}
