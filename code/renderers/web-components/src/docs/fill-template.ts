import {
  ARG_PATH_PATTERN,
  type FillSnippetTemplate,
  printArgPath,
  printValue,
  type PrintValueOptions,
  resolveArgPath,
  UnprintableArgError,
} from 'storybook/internal/docs-tools';
import type { Args } from 'storybook/internal/types';

import { parseSpread } from './template-format.ts';

const ARG_PATHS = new RegExp(ARG_PATH_PATTERN, 'g');
const ARG_HOLE = new RegExp(
  `^(?:(ifDefined)\\(\\s*(${ARG_PATH_PATTERN})\\s*\\)|(${ARG_PATH_PATTERN}))$`
);
const BINDING = /\s([?.@]?)([^\s"'<>=/]+)=$/;
const QUOTED_LIT_BINDING = /\s[?.@][^\s"'<>=/]+=["'][^"']*$/;

// Fills a template in the format `./template-format.ts` describes. A hole that is one arg path
// prints the html lit renders for a primitive value; any other hole keeps its code, with the args
// it reads printed in place.
export const fillTemplate: FillSnippetTemplate = (template, args) => {
  let out = '';
  let inTag = false;
  let quote: string | undefined;
  for (let index = 0; index < template.length; index++) {
    const char = template[index]!;
    if (char === '\\') {
      out += template[++index] ?? '';
    } else if (char === '$' && template[index + 1] === '{') {
      const end = holeEnd(template, index + 2);
      out = fillHole(out, template.slice(index + 2, end).trim(), args, { inTag, quote });
      index = end;
    } else {
      if (!inTag) {
        inTag = char === '<' && /[A-Za-z]/.test(template[index + 1] ?? '');
      } else if (quote) {
        quote = char === quote ? undefined : quote;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        inTag = false;
      }
      out += char;
    }
  }
  return out;
};

function fillHole(
  out: string,
  expression: string,
  args: Args,
  { inTag, quote }: { inTag: boolean; quote?: string }
): string {
  const spread = parseSpread(expression);
  if (spread) {
    const attributes = spreadAttributes(spread, args);
    return out.trimEnd() + attributes.map((attribute) => ` ${attribute}`).join('');
  }
  const asCode = () =>
    `${out}\${${expression.replace(ARG_PATHS, (path) => printArgPath(path, args, PRINT_OPTIONS))}}`;
  const hole = ARG_HOLE.exec(expression);
  if (!hole) {
    return asCode();
  }
  const { value, rest, key } = resolveArgPath(hole[2] ?? hole[3]!, args);
  if (rest !== '') {
    return asCode();
  }
  if (quote && QUOTED_LIT_BINDING.test(out)) {
    return asCode();
  }
  const binding = inTag && !quote ? BINDING.exec(out) : null;
  if (!binding) {
    if (isUnset(value)) {
      return out;
    }
    if (!isPrimitive(value)) {
      return asCode();
    }
    return out + (quote ? escapeAttribute(String(value), quote) : escapeText(String(value)));
  }
  // `name=${…}`, `?name=${…}`, `.name=${…}` or `@name=${…}`, as lit binds it.
  const [written, prefix = '', name = ''] = binding;
  const before = out.slice(0, -written.length);
  switch (prefix) {
    case '?':
      return value ? `${before} ${name}` : before.trimEnd();
    case '.':
      return `${before} .${name}=\${${printCode(value, key)}}`;
    case '@':
      return `${before} @${name}=\${${printHandler(value, key)}}`;
    default:
      if (isUnset(value)) {
        return hole[1] ? before.trimEnd() : `${before} ${name}=""`;
      }
      return isPrimitive(value)
        ? `${before} ${name}="${escapeAttribute(String(value))}"`
        : asCode();
  }
}

// The args a spread sets, as the attribute, property or custom property it maps each to. An
// attribute backed by a field, `.field=attribute`, is set through the field for a value its
// attribute cannot show, as `bindArgs` does.
function spreadAttributes(spread: Record<string, string | null>, args: Args): string[] {
  const attributes: string[] = [];
  const style: string[] = [];
  for (const [arg, binding] of Object.entries(spread)) {
    const value = args[arg];
    if (isUnset(value) || typeof value === 'function') {
      continue;
    }
    if (binding === null) {
      throw new UnprintableArgError(arg);
    }
    const [, field, attribute] = /^(?:\.([^=]+)=)?(.*)$/.exec(binding)!;
    if (binding.startsWith('--')) {
      style.push(`${binding}: ${String(value)};`);
    } else if (binding.startsWith('.') && field === undefined) {
      attributes.push(`${binding}=\${${printCode(value, arg)}}`);
    } else if (value === '' || value === false) {
      if (field !== undefined) {
        attributes.push(`.${field}=\${${printCode(value, arg)}}`);
      }
    } else {
      const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      attributes.push(value === true ? attribute! : `${attribute}="${escapeAttribute(text)}"`);
    }
  }
  return style.length === 0
    ? attributes
    : [...attributes, `style="${escapeAttribute(style.join(' '))}"`];
}

const isUnset = (value: unknown) => value === undefined || value === null;

const isPrimitive = (value: unknown) =>
  ['string', 'number', 'boolean', 'bigint'].includes(typeof value);

const escapeAttribute = (text: string, quote = '"') =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replaceAll(quote, quote === '"' ? '&quot;' : '&#39;');

const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LIT_TAGS: Record<number, string> = { 1: 'html', 2: 'svg', 3: 'mathml' };

// A lit template prints as the code that writes it; another lit value, such as a directive, cannot.
const PRINT_OPTIONS: PrintValueOptions = {
  printCustom: (value, { name }) => {
    if (typeof value !== 'object' || value === null || !Object.keys(value).some(isLitKey)) {
      return undefined;
    }
    const {
      _$litType$: type,
      strings,
      values,
    } = value as {
      _$litType$?: number;
      strings?: readonly string[];
      values?: readonly unknown[];
    };
    if (type === undefined || !LIT_TAGS[type] || !strings || !values) {
      throw new UnprintableArgError(name ?? 'value');
    }
    const code = strings
      .map((text, index) => {
        const hole = index === 0 ? '' : `\${${printValue(values[index - 1], PRINT_OPTIONS)}}`;
        return hole + text.replace(/\\|`|\$\{/g, '\\$&');
      })
      .join('');
    return `${LIT_TAGS[type]}\`${code}\``;
  },
};

const isLitKey = (key: string) => key.startsWith('_$lit');

const printCode = (value: unknown, name: string) => printValue(value, { ...PRINT_OPTIONS, name });

// A listener named after its arg, or an empty handler when the arg's name is not a variable, such
// as a manifest event's `my-change-event`.
const printHandler = (value: unknown, name: string) =>
  typeof value === 'function' && !/^[A-Za-z_$][\w$]*$/.test(name)
    ? '() => {}'
    : printCode(value, name);

// The index of the `}` that closes a hole whose code starts at `start`, past nested brackets,
// strings, template literals and comments.
function holeEnd(code: string, start: number): number {
  let depth = 0;
  for (let index = start; index < code.length; index++) {
    const char = code[index]!;
    if (char === '"' || char === "'") {
      index = quoteEnd(code, index + 1, char);
    } else if (char === '`') {
      index = templateLiteralEnd(code, index + 1);
    } else if (code.startsWith('/*', index)) {
      index = code.indexOf('*/', index + 2) + 1 || code.length;
    } else if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      if (depth === 0) {
        return index;
      }
      depth -= 1;
    }
  }
  return code.length;
}

function quoteEnd(code: string, start: number, quote: string) {
  let index = start;
  while (index < code.length && code[index] !== quote) {
    index += code[index] === '\\' ? 2 : 1;
  }
  return index;
}

function templateLiteralEnd(code: string, start: number) {
  let index = start;
  while (index < code.length && code[index] !== '`') {
    if (code[index] === '\\') {
      index += 2;
    } else if (code.startsWith('${', index)) {
      index = holeEnd(code, index + 2) + 1;
    } else {
      index += 1;
    }
  }
  return index;
}
