// How a story-docs snippet prints one arg's value in its place. The story-docs build prints the
// static snippet with it, and the preview fills a template's holes with it, so the two print alike.
// It stays free of `@angular/core`, as the preview and the dev server both import it.

export const isValidIdentifier = (name: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);

// Angular expression strings support backslash escapes, so quoting stays lossless.
const quoteExpressionString = (value: string): string =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;

/**
 * Renders an arg value as the template expression or class field code a story-docs snippet holds
 * for it, losslessly for strings carrying quotes. The story-docs build prints the args it
 * evaluates with it, and the preview the args a control changed, so the two print alike. A value
 * with no such code, such as a function or a class instance, is `unprintable`.
 */
export const printExpressionValue = (
  value: unknown,
  unprintable: () => never = () => {
    throw new TypeError('The value has no expression');
  },
  seen = new Set<unknown>()
): string => {
  if (typeof value === 'string') {
    return quoteExpressionString(value);
  }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
    return unprintable();
  }
  if (typeof value !== 'object' || value === null) {
    return `${value}`;
  }
  if (seen.has(value)) {
    return quoteExpressionString('[Circular]');
  }
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return unprintable();
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((element) => printExpressionValue(element ?? null, unprintable, seen)).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(
      ([key, entryValue]) =>
        `${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printExpressionValue(entryValue, unprintable, seen)}`
    );
  return `{${entries.join(', ')}}`;
};

/**
 * Escapes an expression for the double-quoted attribute it lands in: the delimiter and text
 * Angular's lexer would decode as a character reference survive the round-trip unchanged.
 */
export const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

/**
 * A template literal is the only quoting that survives a multi-line template carrying both quote
 * characters, so the three sequences that would end or escape it are neutralized.
 */
export const escapeTemplateLiteral = (template: string): string =>
  template.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/** An `[input]` binding of `expression`, as the snippet writes one. */
export const inputBinding = (name: string, expression: string): string =>
  `[${name}]="${expression}"`;

/**
 * The text a value prints as where the story's markup interpolates it, as written, or `undefined`
 * for a value that is no text.
 */
export const textValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  return typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined;
};

/** Code over several lines, its lines after the first indented by `indent`. */
export const indentLines = (code: string, indent: string): string =>
  code.split('\n').join(`\n${indent}`);
