// How a story-docs snippet prints one arg's value in its place. The story-docs build prints the
// static snippet with it, and the preview fills a template's holes with it, so the two print alike.
// It stays free of `@angular/core`, as the preview and the dev server both import it.

/**
 * Where a story-docs snippet prints an arg's value, which decides how the preview prints a new one
 * there. The build writes its fields into each hole of a story's template, next to the hole's
 * `arg`, and `printHole` reads them.
 *
 * - `bind`: the expression of a `[name]="…"` binding.
 * - `prop`: a whole `[name]="…"` binding `argsToTemplate` expands, which an unset arg leaves out.
 * - `field`: the code of a host component field.
 * - `text`: text the story's markup interpolates, as written.
 */
export interface AngularHolePlace {
  kind: 'bind' | 'prop' | 'field' | 'text';
  /**
   * The spaces the snippet indents the lines after the first of a value over several lines by,
   * which the preview indents a new value by too. Left out for none.
   */
  indent?: number;
}

export const isValidIdentifier = (name: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);

// Angular expression strings support backslash escapes, so quoting stays lossless.
const quoteExpressionString = (value: string): string =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;

// Renders an arg value as the template expression or class field code a story-docs snippet holds
// for it, losslessly for strings carrying quotes. The story-docs build prints the values it
// evaluates from the story with it, as next does. The preview prints a value a control changed
// with it and passes `unprintable`, which a value with no such code calls: a function, a symbol, a
// class instance, a cycle, or `NaN` or `Infinity`, which an Angular template reads as fields.
export const printExpressionValue = (value: unknown, unprintable?: () => never): string =>
  unprintable ? printStrict(value, unprintable, new Set()) : printEvaluated(value, new Set());

const printEvaluated = (value: unknown, seen: Set<unknown>): string => {
  if (typeof value === 'string') {
    return quoteExpressionString(value);
  }
  if (typeof value !== 'object' || value === null) {
    return `${value}`;
  }
  if (seen.has(value)) {
    return quoteExpressionString('[Circular]');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((element) => printEvaluated(element ?? null, seen)).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(
      ([key, entryValue]) =>
        `${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printEvaluated(entryValue, seen)}`
    );
  return `{${entries.join(', ')}}`;
};

const printStrict = (value: unknown, unprintable: () => never, parents: Set<unknown>): string => {
  if (
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    typeof value === 'bigint' ||
    (typeof value === 'number' && !Number.isFinite(value))
  ) {
    return unprintable();
  }
  if (typeof value !== 'object' || value === null) {
    return printEvaluated(value, parents);
  }
  const prototype = Object.getPrototypeOf(value);
  if (
    parents.has(value) ||
    (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)
  ) {
    return unprintable();
  }
  parents.add(value);
  const printed = Array.isArray(value)
    ? `[${value.map((element) => printStrict(element ?? null, unprintable, parents)).join(', ')}]`
    : `{${Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(
          ([key, entryValue]) =>
            `${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printStrict(entryValue, unprintable, parents)}`
        )
        .join(', ')}}`;
  parents.delete(value);
  return printed;
};

// Escapes an expression for the double-quoted attribute it lands in: the delimiter and text
// Angular's lexer would decode as a character reference survive the round-trip unchanged.
export const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

// A template literal is the only quoting that survives a multi-line template carrying both quote
// characters, so the three sequences that would end or escape it are neutralized.
export const escapeTemplateLiteral = (template: string): string =>
  template.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

// An `[input]` binding of `expression`, as the snippet writes one.
export const inputBinding = (name: string, expression: string): string =>
  `[${name}]="${expression}"`;

// The text a value prints as where the story's markup interpolates it, as written, or `undefined`
// for a value that is no text.
export const textValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
};

// Code over several lines, its lines after the first indented by `indent`.
export const indentLines = (code: string, indent: string): string =>
  code.split('\n').join(`\n${indent}`);
