// Prints an arg value as the expression an Angular binding carries, and escapes it for the
// attribute position it lands in. Imported by the dev-server story-docs provider and by the
// preview, so this module must stay free of `@angular/core`, Babel, `csf-tools`, `core-server` and
// of any Node built-in.
import { isValidIdentifier } from './template-grammar.ts';

// Angular expression strings support backslash escapes, so quoting stays lossless.
const quoteExpressionString = (value: string): string =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;

// An Angular template expression may only name the component's own members, so a value that needs a
// global (`Symbol`, `BigInt`, `new Date`) or carries behaviour (a function) has no form here at all.
// `Object` and a null prototype are the only shapes whose entries can be printed as an object
// literal; anything else - `Date`, `Map`, `Set`, `RegExp`, a class instance - would print as `{}`
// and quietly claim the arg is empty.
const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const print = (value: unknown, seen: Set<unknown>): string | undefined => {
  if (typeof value === 'string') {
    return quoteExpressionString(value);
  }
  if (typeof value === 'symbol' || typeof value === 'bigint' || typeof value === 'function') {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) {
    return `${value}`;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const elements = value.map((element) => print(element ?? null, seen));
    return elements.every((element) => element !== undefined)
      ? `[${elements.join(', ')}]`
      : undefined;
  }
  if (!isPlainObject(value)) {
    return undefined;
  }
  const entries: string[] = [];
  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === undefined) {
      continue;
    }
    const printed = print(entryValue, seen);
    if (printed === undefined) {
      return undefined;
    }
    entries.push(`${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printed}`);
  }
  return `{${entries.join(', ')}}`;
};

/**
 * Renders an arg value as a template expression, or `undefined` when it has none.
 *
 * Declining is the point. A value with no expression form has no honest rendering: printing
 * something plausible would put source in front of a reader that does not compile or does not mean
 * what it says. Callers keep whatever they had instead - on the server the arg falls back to its
 * authored source text, and in the preview the whole snippet falls back to the server's.
 */
export const printArgExpression = (value: unknown): string | undefined => print(value, new Set());

/**
 * Escapes an expression for the double-quoted attribute it is about to sit in.
 *
 * The delimiter and any text Angular's lexer would decode as a character reference survive the
 * round-trip unchanged.
 */
export const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');
