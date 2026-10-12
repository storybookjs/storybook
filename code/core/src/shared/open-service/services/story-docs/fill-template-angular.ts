/**
 * Fills an Angular story-docs `template` with the current args (POC).
 *
 * The angular-vite provider marks where args go:
 *
 * - `{{args}}` on an element: every set arg as a binding, `label="Click"` for a string and
 *   `[primary]="true"` for anything else. Functions are skipped; outputs are bound by name already.
 * - `[label]="{{args.label}}"`: that one binding, in the same form, and dropped when the arg is unset.
 * - Any other `{{args.label}}` (a host component field): the arg as an expression.
 *
 * Angular's own `{{ interpolation }}` never reads `args`, since stories pass `props: args`.
 */
export function fillAngularTemplate(template: string, args: Record<string, unknown> = {}): string {
  return (
    template
      // <app-button {{args}} /> => <app-button label="Click" [primary]="true" />
      .replace(/([ \t]*\n[ \t]*| )?\{\{args\}\}/g, (_match, separator: string | undefined) => {
        const bindings = Object.entries(args)
          .map(([name, value]) => toBinding(name, value))
          .filter((binding): binding is string => binding !== null);
        const joiner = separator?.includes('\n') ? separator : ' ';
        return bindings.map((binding) => `${joiner}${binding}`).join('');
      })
      // [label]="{{args.label}}" => label="Click"
      .replace(
        /([ \t]*\n[ \t]*| )\[([\w.-]+)\]="\{\{args\.([\w$]+)\}\}"/g,
        (_match, separator: string, name: string, key: string) => {
          const binding = toBinding(name, args[key]);
          return binding === null ? '' : `${separator}${binding}`;
        }
      )
      // label = {{args.label}}; => label = 'Click';
      .replace(/\{\{args\.([\w$]+)\}\}/g, (_match, key: string) => toExpression(args[key]))
  );
}

const toBinding = (name: string, value: unknown): string | null => {
  if (value === undefined || value === null || typeof value === 'function') {
    return null;
  }
  if (typeof value === 'string' && !/["\n{}]/.test(value)) {
    return `${name}="${value}"`;
  }
  return `[${name}]="${toExpression(value).replace(/"/g, '&quot;')}"`;
};

const isIdentifier = (key: string) => /^[A-Za-z_$][\w$]*$/.test(key);

const quote = (text: string) =>
  `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

/** Prints an arg value as the Angular template expression (and TS literal) it would be written as. */
const toExpression = (value: unknown, depth = 0): string => {
  if (typeof value === 'string') {
    return quote(value);
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'function') {
    return '() => {}';
  }
  if (value instanceof Date) {
    return quote(value.toISOString());
  }
  if (Array.isArray(value)) {
    return depth > 3 ? '[]' : `[${value.map((item) => toExpression(item, depth + 1)).join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    if (depth > 3) {
      return '{}';
    }
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(
        ([key, item]) => `${isIdentifier(key) ? key : quote(key)}: ${toExpression(item, depth + 1)}`
      );
    return `{${entries.join(', ')}}`;
  }
  return String(value);
};
