import { resolveArgPath, valueToString } from './fill-template.ts';

/**
 * Fills a lit `html` story-docs template with the current args, the lit counterpart of
 * `fillSnippetTemplate`. The template is the story's html as authored with arg holes written as
 * `${args.x}`, plus `${args}` where the provider synthesized the element from its args:
 *
 * - `${args}` inside a tag becomes all args as attributes (objects as `.prop=${...}`).
 * - `attr=${args.x}` / `attr="${args.x}"` becomes `attr="value"`, `attr` for `true`, and is dropped
 *   for `false`/unset; objects become `.attr=${...}`.
 * - `?attr=${args.x}` becomes `attr` when truthy, and `.prop=${args.x}` keeps its binding with the value.
 * - `${args.x}` in text becomes the (HTML-escaped) value.
 *
 * Any other `${...}` expression is left as written.
 */
export function fillLitTemplate(template: string, args: Record<string, unknown> = {}): string {
  return (
    template
      // <my-el ${args}> => <my-el label="Click" primary>
      .replace(/\s*\$\{\s*args\s*\}/g, () =>
        Object.entries(args)
          .map(([key, value]) => attribute('', key, value))
          .filter((attr): attr is string => attr !== null)
          .map((attr) => ` ${attr}`)
          .join('')
      )
      // label=${args.label}, ?primary="${args.primary}", .items=${args.items}
      .replace(
        new RegExp(`\\s([?.@]?)([\\w:-]+)=("?)\\$\\{\\s*(${ARG_PATH})\\s*\\}\\3`, 'g'),
        (match, prefix: string, name: string, _quote: string, argPath: string) => {
          if (prefix === '@') {
            return match;
          }
          const { value, rest } = resolveArgPath(argPath, args);
          if (rest) {
            return match;
          }
          const attr = attribute(prefix, name, value);
          return attr === null ? '' : `${match[0]}${attr}`;
        }
      )
      // <p>${args.label}</p> => <p>Click</p> (listeners stay as written)
      .replace(
        new RegExp(`(?<!@[\\w:.-]+="?)\\$\\{\\s*(${ARG_PATH})\\s*\\}`, 'g'),
        (match, argPath: string) => {
          const { value, rest } = resolveArgPath(argPath, args);
          if (rest) {
            return match;
          }
          if (value === undefined || value === null || value === false) {
            return '';
          }
          return isPrimitive(value) ? escapeHtml(String(value)) : `\${${valueToString(value)}}`;
        }
      )
  );
}

const ARG_PATH = String.raw`args(?:\??\.[\w$]+|\[\d+\]|\[(?:"[^"]*"|'[^']*')\])+`;

const isPrimitive = (value: unknown): value is string | number | boolean | bigint =>
  ['string', 'number', 'boolean', 'bigint'].includes(typeof value);

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttribute = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** One lit binding as static-looking HTML, or `null` when it renders nothing. */
const attribute = (prefix: string, name: string, value: unknown): string | null => {
  if (typeof value === 'function') {
    return null;
  }
  if (prefix === '.') {
    return `.${name}=\${${valueToString(value)}}`;
  }
  if (prefix === '?') {
    return value ? name : null;
  }
  if (value === undefined || value === null || value === false) {
    return null;
  }
  if (value === true) {
    return name;
  }
  if (isPrimitive(value)) {
    return `${name}="${escapeAttribute(String(value))}"`;
  }
  return `.${name}=\${${valueToString(value)}}`;
};
