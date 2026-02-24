/**
 * Escape special characters in a string for safe use within template literals in generated code.
 * This escapes backticks and template expression delimiters.
 *
 * @example
 *
 * ```ts
 * const fileName = "button's.tsx";
 * const template = `import Button from './${escapeForTemplate(fileName)}'`;
 * // Results in: import Button from './button\\'s.tsx'
 * ```
 */
export function escapeForTemplate(str: string): string {
  return str.replace(/[`$'"\\\n\r]/g, (char) => {
    const codes: Record<string, string> = {
      '`': '\\`',
      "'": "\\'",
      '"': '\\"',
      $: '\\$',
      '\\': '\\\\',
      '\n': '\\n',
      '\r': '\\r',
    };
    return codes[char] || char;
  });
}
