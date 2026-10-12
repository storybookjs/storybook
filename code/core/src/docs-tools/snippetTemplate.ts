import type { Args } from 'storybook/internal/types';

/**
 * Fills a story-docs `template` with the current args, so the story's snippet follows the controls.
 *
 * A renderer sets it as `parameters.docs.source.fillTemplate` next to a story-docs provider that
 * emits `template`. It throws an {@link UnprintableArgError} for an arg whose value the snippet
 * cannot show, and the static snippet is shown instead.
 */
export type FillSnippetTemplate = (template: string, args: Args) => string;

/** Thrown by a {@link FillSnippetTemplate} for an arg whose value the snippet cannot show. */
export class UnprintableArgError extends Error {
  override readonly name = 'UnprintableArgError';

  constructor(readonly argName: string) {
    super(`The snippet cannot show the value of the \`${argName}\` arg.`);
  }
}

const IDENTIFIER = String.raw`[A-Za-z_$][\w$]*`;
const SEGMENT = String.raw`\??\.${IDENTIFIER}|(?:\?\.)?\[(?:\d+|"[^"]*"|'[^']*')\]`;
// `args` itself, not a member of another object (`story.args`) or a longer name (`argsTable`).
const NOT_A_MEMBER = String.raw`(?<![\w$])(?<![^.]\.)(?<!^\.)`;

/** `args.a`, `args?.a.b`, `args['a'][0]`: a path into the args, which `...args` may spread. */
export const ARG_PATH_PATTERN = `${NOT_A_MEMBER}args(?:${SEGMENT})+`;

const SEGMENTS = new RegExp(SEGMENT, 'g');

// The key a path segment reads: `label` for `.label`, `?.label` and `["label"]`, `0` for `[0]`.
const segmentKey = (segment: string) => {
  const key = segment.replace(/^\??\.?\[?|\]$/g, '');
  return /^["']/.test(key) ? key.slice(1, -1) : key;
};

/**
 * Follows an arg path as far as it reads arg data, so `args.items.map` resolves to the `items` arg
 * with `.map` left as written. `key` is the last key it read, the name the value is passed as.
 */
export function resolveArgPath(
  path: string,
  args: Args
): { value: unknown; rest: string; key: string } {
  let value: unknown = args;
  let key = 'args';
  let consumed = key.length;
  for (const [segment] of path.slice(consumed).matchAll(SEGMENTS)) {
    const nextKey = segmentKey(segment);
    if (value !== args && !(isPlainData(value) && Object.hasOwn(value, nextKey))) {
      break;
    }
    value = (value as Record<string, unknown>)[nextKey];
    key = nextKey;
    consumed += segment.length;
  }
  return { value, rest: path.slice(consumed), key };
}

const isPlainData = (value: unknown): value is object => {
  if (Array.isArray(value)) {
    return true;
  }
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isIdentifier = (name: string) => new RegExp(`^${IDENTIFIER}$`).test(name);

const RESERVED_WORDS = new Set(
  (
    'await break case catch class const continue debugger default delete do else enum export ' +
    'extends false finally for function if implements import in instanceof interface let new null ' +
    'package private protected public return static super switch this throw true try typeof var ' +
    'void while with yield'
  ).split(' ')
);

// Whether `name` can stand in for a value as a variable: `onClick`, not `default` or `data-x`.
const isReference = (name: string) => isIdentifier(name) && !RESERVED_WORDS.has(name);

export interface PrintValueOptions {
  /** The arg or property the value is passed as, printed in place of a value code cannot show. */
  name?: string;
  /** The quote strings are written with; `'` inside a double-quoted attribute. */
  quote?: '"' | "'";
  /** Prints a renderer-specific value, such as a React element, or returns `undefined`. */
  printCustom?: (value: unknown, options: PrintValueOptions) => string | undefined;
}

const MAX_DEPTH = 4;
const MAX_LENGTH = 500;

/**
 * Prints an arg value as the JavaScript expression it would be written as.
 *
 * A value that has no readable literal (a function, a class instance, a value nested too deep or too
 * long to read) prints as its `name`, so `onClick: fn()` shows as `onClick`, and a property as its
 * key. Where no name reads as a variable, such as for an array item, it throws an
 * {@link UnprintableArgError}.
 */
export function printValue(value: unknown, options: PrintValueOptions = {}): string {
  const printed = print(value, options, 0);
  if (printed !== undefined) {
    return printed;
  }
  if (options.name !== undefined && isReference(options.name)) {
    return options.name;
  }
  throw new UnprintableArgError(options.name ?? 'value');
}

/**
 * Prints the arg an arg path reads, followed by the part of the path that is not arg data:
 * `args.label.toUpperCase()` with `label: 'Go'` prints `"Go".toUpperCase()`. A negative number or
 * bigint, or a number followed by a member, is wrapped in parentheses so the code still reads the
 * same.
 */
export function printArgPath(
  path: string,
  args: Args,
  options: Omit<PrintValueOptions, 'name'> = {}
): string {
  const { value, rest, key } = resolveArgPath(path, args);
  const printed = printValue(value, { ...options, name: key });
  const isNumeric = typeof value === 'number' || typeof value === 'bigint';
  const needsParentheses = isNumeric && (printed.startsWith('-') || /^\??\./.test(rest));
  return (needsParentheses ? `(${printed})` : printed) + rest;
}

function print(value: unknown, options: PrintValueOptions, depth: number): string | undefined {
  const custom = options.printCustom?.(value, options);
  if (custom !== undefined) {
    return custom;
  }
  switch (typeof value) {
    case 'string':
      return quoteString(value, options.quote ?? '"');
    case 'number':
    case 'boolean':
      return String(value);
    case 'bigint':
      return `${value}n`;
    case 'undefined':
      return 'undefined';
    case 'function':
    case 'symbol':
      return undefined;
  }
  if (value === null) {
    return 'null';
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? undefined
      : `new Date(${quoteString(value.toISOString(), options.quote ?? '"')})`;
  }
  if (depth >= MAX_DEPTH || !isPlainData(value)) {
    return undefined;
  }
  return Array.isArray(value)
    ? printArray(value, options, depth)
    : printObject(value as Record<string, unknown>, options, depth);
}

function printArray(items: unknown[], options: PrintValueOptions, depth: number) {
  const printed: string[] = [];
  let length = 2;
  for (const item of items) {
    const entry = print(item, { ...options, name: undefined }, depth + 1);
    if (entry === undefined) {
      return undefined;
    }
    length += entry.length + 2;
    if (length > MAX_LENGTH) {
      return undefined;
    }
    printed.push(entry);
  }
  return `[${printed.join(', ')}]`;
}

function printObject(object: Record<string, unknown>, options: PrintValueOptions, depth: number) {
  const entries: string[] = [];
  let length = 4;
  for (const [key, item] of Object.entries(object)) {
    if (item === undefined) {
      continue;
    }
    const printed = print(item, { ...options, name: key }, depth + 1);
    // Like an arg, a property with no readable literal prints as its name: `{ onSelect }`.
    if (printed === undefined && !isReference(key)) {
      return undefined;
    }
    const printedKey = isIdentifier(key) ? key : quoteString(key, options.quote ?? '"');
    const entry = printed === undefined ? key : `${printedKey}: ${printed}`;
    length += entry.length + 2;
    if (length > MAX_LENGTH) {
      return undefined;
    }
    entries.push(entry);
  }
  return entries.length > 0 ? `{ ${entries.join(', ')} }` : '{}';
}

function quoteString(text: string, quote: '"' | "'") {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replaceAll(quote, `\\${quote}`);
  return `${quote}${escaped}${quote}`;
}
