import {
  ARG_PATH,
  type MockableFunction,
  getFunctionName,
  lineIndent,
  resolveArgPath,
} from './fill-template.ts';

/**
 * Fills a Vue story-docs `template` with the current args, the Vue counterpart of
 * `fillSnippetTemplate`: `v-bind="args"` becomes the args as attributes, `:x="args.y"` becomes a
 * filled attribute (dropped when the arg is unset), `{{ args.x }}` becomes plain text, and any other
 * `args.x` becomes its value. The template structure stays as written.
 *
 * @example `<Button v-bind="args" />` with `{ label: 'Hi', primary: true, size: 2 }`
 *   → `<Button label="Hi" primary :size="2" />`
 */
export function fillVueTemplate(code: string, args: Record<string, unknown> = {}): string {
  const attrs = Object.entries(args)
    .map(([key, value]) => argToAttr(key, value))
    .filter((attr): attr is string => attr !== null);

  return (
    code
      // <Button v-bind="args" /> => <Button label="Click" primary />
      .replace(
        / ?\bv-bind="args"( ?\/?>)?/g,
        (_match, closer: string | undefined, offset: number) =>
          spreadAttrs(attrs, lineIndent(code, offset), closer)
      )
      // :label="args.label" => label="Click", and dropped when the arg is unset
      .replace(
        new RegExp(`\\s(?::|v-bind:)([\\w-]+)="\\s*(${ARG_PATH.source})\\s*"`, 'g'),
        (match, name: string, argPath: string) => {
          const { value, rest } = resolveArgPath(argPath, args);
          if (rest) {
            return match;
          }
          const attr = argToAttr(name, value);
          return attr === null ? '' : `${match[0]}${attr}`;
        }
      )
      // {{ args.label }} => Click
      .replace(new RegExp(`\\{\\{\\s*(${ARG_PATH.source})\\s*\\}\\}`, 'g'), (match, argPath) => {
        const { value, rest } = resolveArgPath(argPath, args);
        if (rest || value === undefined || value === null || typeof value === 'object') {
          return match;
        }
        return typeof value === 'string' && /[<>{}]/.test(value) ? match : String(value);
      })
      // any other reference, eg. v-if="args.loading" => v-if="true"
      .replace(new RegExp(ARG_PATH.source, 'g'), (argPath) => {
        const { value, rest } = resolveArgPath(argPath, args);
        return vueExpression(value) + rest;
      })
  );
}

/** The attributes in place of `v-bind="args"`, on one line when short, one per line otherwise. */
function spreadAttrs(attrs: string[], indent: string, closer = '') {
  const oneLine = attrs.map((attr) => ` ${attr}`).join('');
  if (oneLine.length <= 50) {
    return oneLine + closer;
  }
  const lines = attrs.map((attr) => `\n${indent}  ${attr}`).join('');
  return closer ? `${lines}\n${indent}${closer.trim()}` : `${lines}\n${indent}  `;
}

const isIdentifier = (key: string) => /^[A-Za-z_$][\w$]*$/.test(key);

/**
 * Prints an arg value as a JS expression that fits in a double-quoted Vue attribute, so strings use
 * single quotes.
 */
function vueExpression(value: unknown, depth = 0): string {
  if (typeof value === 'function') {
    return getFunctionName(value as MockableFunction);
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/"/g, '&quot;')}'`;
  }
  if (Array.isArray(value)) {
    return depth > 3 ? '[]' : `[${value.map((item) => vueExpression(item, depth + 1)).join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
    if (depth > 3) {
      return '{}';
    }
    const entries = Object.entries(value).map(
      ([key, item]) => `${isIdentifier(key) ? key : `'${key}'`}: ${vueExpression(item, depth + 1)}`
    );
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return JSON.stringify(value) ?? String(value);
}

/** Convert a {key: value} pair into a Vue attribute, eg. {label: "Click"} => label="Click" */
function argToAttr(key: string, value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (value === true) {
    return key;
  }
  if (typeof value === 'string' && !/["\n]/.test(value)) {
    return `${key}="${value}"`;
  }
  // onClick: fn => @click="onClick"
  if (typeof value === 'function' && /^on[A-Z]/.test(key)) {
    const event = key.charAt(2).toLowerCase() + key.slice(3);
    return `@${event}="${getFunctionName(value as MockableFunction)}"`;
  }
  return `:${key}="${vueExpression(value)}"`;
}
