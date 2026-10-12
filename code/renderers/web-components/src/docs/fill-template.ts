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

import {
  escapeAttribute,
  escapeTemplateText,
  escapeText,
  MAX_LINE,
  parseSpread,
  printAttribute,
  printCssProperties,
  type SpreadBinding,
} from './template-format.ts';

// Fills a template in the format `./template-format.ts` describes.
const EXACT_PATH = new RegExp(
  `^(?:(ifDefined|unsafeHTML)\\(\\s*(${ARG_PATH_PATTERN})\\s*\\)|(${ARG_PATH_PATTERN}))$`
);
const ARG_PATHS = new RegExp(ARG_PATH_PATTERN, 'g');
const BINDING = /(\s+)([?.@]?)([^\s"'<>=/]+)=$/;
const CONDITIONAL = new RegExp(`^(${ARG_PATH_PATTERN})\\s*\\?(?![?.])`);
const JSON_LITERAL =
  /^(?:"(?:[^"\\]|\\["\\/bfnrt]|\\u[\dA-Fa-f]{4})*"|-?\d+(?:\.\d+)?|true|false|null)$/;
const NOTHING = Symbol.for('lit-nothing');
const LIT_TAGS = { 1: 'html', 2: 'svg', 3: 'mathml' } as const;

export const fillTemplate: FillSnippetTemplate = (template, args) => {
  let out = '';
  let inTag = false;
  let quote: string | undefined;
  let index = 0;
  while (index < template.length) {
    const char = template[index]!;
    if (char === '\\') {
      out += template[index + 1] ?? '';
      index += 2;
      continue;
    }
    if (char === '$' && template[index + 1] === '{') {
      const end = scanTo(template, index + 2, '}');
      const expression = pickBranch(template.slice(index + 2, end).trim(), args);
      index = end + 1;
      if (inTag && quote) {
        out += interpolate(expression, args);
      } else if (inTag) {
        out = fillTagHole(out, expression, template[index] === '>', args);
      } else {
        const text = fillText(expression, args);
        const alone = /\n[ \t]*$/.exec(out);
        out =
          text === '' && alone && (index === template.length || template[index] === '\n')
            ? out.slice(0, alone.index)
            : out + text;
      }
      continue;
    }
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
    index += 1;
  }
  return out;
};

function fillTagHole(out: string, expression: string, closesTag: boolean, args: Args) {
  const spread = parseSpread(expression);
  if (spread) {
    return fillSpread(out, toAttributes(spread, args), closesTag);
  }
  const binding = BINDING.exec(out);
  if (!binding) {
    return `${out}\${${fillExpression(expression, args)}}`;
  }
  const [written, space, prefix, name] = binding as unknown as [string, string, string, string];
  const attribute = toBinding(prefix, name, expression, args);
  const before = out.slice(0, out.length - written.length);
  return attribute === undefined ? before : `${before}${space}${attribute}`;
}

// A spread that is all of its tag lays the tag out as the snippet would: on one line when it fits,
// otherwise one attribute per line.
function fillSpread(out: string, attributes: string[], closesTag: boolean) {
  const space = /\s*$/.exec(out)![0];
  const before = out.slice(0, out.length - space.length);
  if (attributes.length === 0) {
    return before;
  }
  const isWholeTag = closesTag && /<[^\s<>]+$/.test(before);
  if (!isWholeTag) {
    return `${before}${space}${attributes.join(space.includes('\n') ? space : ' ')}`;
  }
  const inline = attributes.map((attribute) => ` ${attribute}`).join('');
  const line = before.slice(before.lastIndexOf('\n') + 1);
  if (line.length + inline.length + 1 <= MAX_LINE) {
    return before + inline;
  }
  const indent = /^[ \t]*/.exec(line)![0];
  return `${before}${attributes.map((attribute) => `\n${indent}  ${attribute}`).join('')}\n${indent}`;
}

// An attribute two args set prints once, at the first one's place, with the last one's value.
function toAttributes(bindings: ReadonlyMap<string, SpreadBinding>, args: Args): string[] {
  const attributes = new Map<string, string | undefined>();
  const cssProperties: { name: string; value: unknown }[] = [];
  for (const [arg, binding] of bindings) {
    const value = args[arg];
    if (!Object.hasOwn(args, arg) || (binding.kind === 'unfillable' && value === undefined)) {
      continue;
    }
    if (binding.kind === 'property') {
      if (value !== undefined) {
        attributes.set(`.${binding.name}`, `.${binding.name}=\${${printCode(value, arg)}}`);
      }
    } else if (typeof value === 'function') {
      continue;
    } else if (binding.kind === 'unfillable' || isMarkup(value)) {
      throw new UnprintableArgError(arg);
    } else if (binding.kind === 'style') {
      cssProperties.push({ name: binding.name, value });
    } else {
      attributes.set(
        binding.name,
        value === false && binding.defaultsToTrue
          ? `?${binding.name}=\${false}`
          : printAttribute({ name: binding.name, value, viaField: binding.reflected })
      );
    }
  }
  const printed = [...attributes.values()].filter((attribute) => attribute !== undefined);
  const style = printCssProperties(cssProperties);
  return style === undefined ? printed : [...printed, `style="${escapeAttribute(style)}"`];
}

function toBinding(prefix: string, name: string, expression: string, args: Args) {
  const exact = readExact(expression, args);
  if (!exact || exact.wrapper === 'unsafeHTML') {
    return `${prefix}${name}=\${${fillExpression(expression, args)}}`;
  }
  const { value } = exact;
  if (value === NOTHING) {
    return undefined;
  }
  switch (prefix) {
    case '?':
      return value ? name : undefined;
    case '.':
    case '@':
      return value === undefined
        ? undefined
        : `${prefix}${name}=\${${printCode(value, exact.key)}}`;
    default:
      if (typeof value === 'function') {
        return undefined;
      }
      if (value === undefined || value === null) {
        return exact.wrapper === 'ifDefined' ? undefined : `${name}=""`;
      }
      if (isMarkup(value)) {
        throw new UnprintableArgError(exact.key);
      }
      return `${name}="${escapeAttribute(String(value))}"`;
  }
}

function interpolate(expression: string, args: Args) {
  const exact = readExact(expression, args);
  if (!exact || exact.wrapper) {
    return `\${${fillExpression(expression, args)}}`;
  }
  const { value } = exact;
  if (value === undefined || value === null) {
    return '';
  }
  if (value === NOTHING || isMarkup(value)) {
    throw new UnprintableArgError(exact.key);
  }
  return typeof value === 'function' ? printCode(value, exact.key) : escapeAttribute(String(value));
}

function fillText(expression: string, args: Args) {
  const nested = htmlTemplate(expression);
  if (nested !== undefined) {
    return fillTemplate(nested, args);
  }
  const exact = readExact(expression, args);
  if (!exact) {
    return `\${${fillExpression(expression, args)}}`;
  }
  const { value } = exact;
  if (exact.wrapper === 'unsafeHTML' && value !== undefined && value !== null) {
    return Array.isArray(value) ? value.map((item) => item ?? '').join('') : String(value);
  }
  return childHtml(value, exact.key);
}

// As lit renders a child value: nothing when unset, the items of an array, a template or element
// as its html, the rest as text.
function childHtml(value: unknown, key: string): string {
  if (value === undefined || value === null || value === '' || value === NOTHING) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => childHtml(item, key)).join('');
  }
  if (isLitTemplate(value)) {
    return litTemplateHtml(value);
  }
  if (typeof Element !== 'undefined' && value instanceof Element) {
    return value.outerHTML;
  }
  if (isMarkup(value)) {
    throw new UnprintableArgError(key);
  }
  return typeof value === 'function' || typeof value === 'symbol'
    ? `\${${printCode(value, key)}}`
    : escapeText(String(value));
}

// The value a hole reads: an arg path, bare or wrapped, or a literal a conditional picked.
function readExact(expression: string, args: Args) {
  const literal = readLiteral(expression);
  if (literal) {
    return { ...literal, key: expression, wrapper: undefined };
  }
  const match = EXACT_PATH.exec(expression);
  if (!match) {
    return undefined;
  }
  const { value, rest, key } = resolveArgPath(match[2] ?? match[3]!, args);
  return rest ? undefined : { value, key, wrapper: match[1] };
}

function readLiteral(expression: string): { value: unknown } | undefined {
  if (expression === 'nothing') {
    return { value: NOTHING };
  }
  if (expression === 'undefined') {
    return { value: undefined };
  }
  const quoted = /^'([^'\\]*)'$/.exec(expression);
  if (quoted) {
    return { value: quoted[1] };
  }
  return JSON_LITERAL.test(expression) ? { value: JSON.parse(expression) } : undefined;
}

// `args.x ? a : b` as the branch the arg picks, so that it fills as that hole would.
function pickBranch(expression: string, args: Args): string {
  const test = CONDITIONAL.exec(expression);
  const colon = test ? scanTo(expression, test[0].length, ':') : expression.length;
  if (!test || colon === expression.length) {
    return expression;
  }
  const { value, rest } = resolveArgPath(test[1]!, args);
  if (rest) {
    return expression;
  }
  const branch = value ? expression.slice(test[0].length, colon) : expression.slice(colon + 1);
  return pickBranch(branch.trim(), args);
}

// The template of an html`…` hole.
function htmlTemplate(expression: string) {
  const isWhole =
    expression.startsWith('html`') && templateLiteralEnd(expression, 5) === expression.length - 1;
  return isWhole ? expression.slice(5, -1) : undefined;
}

interface LitTemplate {
  _$litType$: keyof typeof LIT_TAGS;
  strings: readonly string[];
  values: readonly unknown[];
}

const isLitValue = (value: unknown): value is object =>
  typeof value === 'object' &&
  value !== null &&
  Object.keys(value).some((key) => key.startsWith('_$lit'));

// A lit template that keeps its strings, as one written with html`…` does.
const isLitTemplate = (value: unknown): value is LitTemplate =>
  isLitValue(value) &&
  '_$litType$' in value &&
  Object.hasOwn(LIT_TAGS, value._$litType$ as PropertyKey) &&
  'strings' in value &&
  Array.isArray(value.strings);

// A lit value or a DOM node, which no attribute text shows.
const isMarkup = (value: unknown) =>
  isLitValue(value) || (typeof Node !== 'undefined' && value instanceof Node);

// The html a lit template renders, its values filled in as the holes of a template.
function litTemplateHtml({ strings, values }: LitTemplate): string {
  const template = strings
    .map((text, index) => (index === 0 ? '' : `\${args[${index - 1}]}`) + escapeTemplateText(text))
    .join('');
  return fillTemplate(template, { ...values });
}

const PRINT_OPTIONS: PrintValueOptions = {
  printCustom: (value, { name }) => {
    if (isLitTemplate(value)) {
      const html = litTemplateHtml(value).replace(/\\|`|\$\{/g, '\\$&');
      return `${LIT_TAGS[value._$litType$]}\`${html}\``;
    }
    if (isLitValue(value)) {
      throw new UnprintableArgError(name ?? 'an array item');
    }
    return undefined;
  },
};

const printCode = (value: unknown, name: string) => printValue(value, { ...PRINT_OPTIONS, name });

// The expression with each arg path it reads replaced by the value, so `args.items.map(…)` keeps
// its shape around the current items.
const fillExpression = (expression: string, args: Args) =>
  expression.replace(ARG_PATHS, (path) => printArgPath(path, args, PRINT_OPTIONS));

// Where the code from `start` reaches the `}` that closes its hole, or the `:` of the conditional
// it is in, past nested brackets, strings, comments and conditionals.
function scanTo(code: string, start: number, stop: '}' | ':'): number {
  let depth = 0;
  let conditionals = 0;
  let index = start;
  while (index < code.length) {
    const char = code[index]!;
    if (char === '"' || char === "'") {
      index = stringEnd(code, index + 1, char);
    } else if (char === '`') {
      index = templateLiteralEnd(code, index + 1);
    } else if (code.startsWith('/*', index)) {
      const close = code.indexOf('*/', index + 2);
      index = close === -1 ? code.length : close + 1;
    } else if (code.startsWith('??', index) || code.startsWith('?.', index)) {
      index += 1;
    } else if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      if (depth === 0) {
        return stop === '}' ? index : code.length;
      }
      depth -= 1;
    } else if (depth === 0 && char === '?') {
      conditionals += 1;
    } else if (depth === 0 && char === ':') {
      if (stop === ':' && conditionals === 0) {
        return index;
      }
      conditionals -= 1;
    }
    index += 1;
  }
  return code.length;
}

function stringEnd(code: string, start: number, quote: string) {
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
      index = scanTo(code, index + 2, '}') + 1;
    } else {
      index += 1;
    }
  }
  return index;
}
