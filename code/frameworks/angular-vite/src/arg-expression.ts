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
  if (typeof value === 'number') {
    return Number.isFinite(value) ? (Object.is(value, -0) ? '-0' : String(value)) : undefined;
  }
  if (typeof value !== 'object' || value === null) {
    return String(value);
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return undefined;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const elements: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const printed = print(Object.hasOwn(value, index) ? value[index] : null, seen);
        if (printed === undefined) {
          return undefined;
        }
        elements.push(printed);
      }
      return `[${elements.join(', ')}]`;
    }

    const entries: string[] = [];
    for (const [key, entryValue] of Object.entries(value)) {
      const printed = print(entryValue, seen);
      if (printed === undefined) {
        return undefined;
      }
      entries.push(`${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printed}`);
    }
    return `{${entries.join(', ')}}`;
  } finally {
    seen.delete(value);
  }
};

/**
 * Renders an arg value as a template expression, or `undefined` when it has none.
 */
export const printArgExpression = (value: unknown): string | undefined => print(value, new Set());

/**
 * Escapes an expression for the double-quoted attribute it is about to sit in.
 */
export const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');
