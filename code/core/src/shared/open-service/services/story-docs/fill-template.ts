/**
 * Fills a story-docs `template` with the current args, so the snippet follows the controls.
 *
 * Follows how Svelte CSF snippets do it (`generateCodeToEmit` in
 * `renderers/svelte/src/svelte-csf/runtime/emit-code.ts`): `{...args}` becomes the args as
 * attributes, `{args.x}` text becomes plain text, and any other `args.x` becomes its value. The
 * structure of the story is left as written, so `args.loading ? <Spinner /> : <Button />` shows
 * `true ? <Spinner /> : <Button />`.
 */
export function fillSnippetTemplate(code: string, args: Record<string, unknown> = {}): string {
  // children used in the template (e.g. {args.children}) stays out of `{...args}`,
  // so it doesn't appear twice
  const childrenUsedInTemplate = /\bargs\??\.children\b/.test(code);

  const props = Object.entries(args)
    .filter(([key]) => !(childrenUsedInTemplate && key === 'children'))
    .map(([key, value]) => argToProp(key, value))
    .filter((prop): prop is string => prop !== null);

  return (
    code
      // <Button {...args} /> => <Button label="Click" primary />
      .replace(/ ?\{\.\.\.args\}( ?\/?>)?/g, (_match, closer: string | undefined, offset: number) =>
        spreadProps(
          // An element with its own children (`<Button {...args}>Solid</Button>`) overrides `children`
          hasWrittenChildren(code, offset) ? props.filter((prop) => !/^children\b/.test(prop)) : props,
          lineIndent(code, offset),
          closer
        )
      )
      // label={args.label} => label="Click", and dropped when the arg is unset
      .replace(
        new RegExp(`\\s([\\w:-]+)=\\{\\s*(${ARG_PATH.source})\\s*\\}`, 'g'),
        (match, name: string, argPath: string) => {
          const { value, rest } = resolveArgPath(argPath, args);
          if (rest) {
            return match;
          }
          const prop = argToProp(name, value);
          return prop === null ? '' : `${match[0]}${prop}`;
        }
      )
      // <Button>{args.children}</Button> => <Button>Click me</Button>
      .replace(
        new RegExp(`(?<!=)\\{\\s*(${ARG_PATH.source})\\s*\\}`, 'g'),
        (match, argPath: string) => {
          const { value, rest } = resolveArgPath(argPath, args);
          return !rest && isPlainText(value) ? value : match;
        }
      )
      // any other reference, eg. args.loading ? ... => true ? ...
      .replace(new RegExp(ARG_PATH.source, 'g'), (argPath) => {
        const { value, rest } = resolveArgPath(argPath, args);
        return valueToString(value) + rest;
      })
  );
}

/** `args.a`, `args?.a.b`, `args['a'][0]`: a path into the args. */
export const ARG_PATH = /\bargs(?:\??\.[\w$]+|\[\d+\]|\[(?:"[^"]*"|'[^']*')\])+/;
const SEGMENT = /\??\.([\w$]+)|\[(\d+)\]|\[(?:"([^"]*)"|'([^']*)')\]/g;

/**
 * Follows an arg path as far as the args have own data, so `args.items.map` resolves `args.items`
 * and leaves `.map` as written.
 */
export function resolveArgPath(path: string, args: Record<string, unknown>) {
  let value: unknown = args;
  let consumed = 'args'.length;
  for (const segment of path.slice(consumed).matchAll(SEGMENT)) {
    const key = segment[1] ?? segment[2] ?? segment[3] ?? segment[4]!;
    const isData = typeof value === 'object' && value !== null && !isElement(value);
    if (value !== args && !(isData && Object.hasOwn(value, key))) {
      break;
    }
    value = (value as Record<string, unknown>)[key];
    consumed += segment[0].length;
  }
  return { value, rest: path.slice(consumed) };
}

/** Whether the element whose tag holds the spread at `offset` ends in `>` rather than `/>`. */
function hasWrittenChildren(code: string, offset: number) {
  const tagEnd = /(?<!=)\/?>/.exec(code.slice(offset));
  return tagEnd?.[0] === '>';
}

export function lineIndent(code: string, offset: number) {
  const lineStart = code.lastIndexOf('\n', offset) + 1;
  return /^[ \t]*/.exec(code.slice(lineStart))![0];
}

/** The props in place of `{...args}`, on one line when short, one per line otherwise. */
function spreadProps(props: string[], indent: string, closer = '') {
  const oneLine = props.map((prop) => ` ${prop}`).join('');
  if (oneLine.length <= 50) {
    return oneLine + closer;
  }
  const lines = props.map((prop) => `\n${indent}  ${prop}`).join('');
  return closer ? `${lines}\n${indent}${closer.trim()}` : `${lines}\n${indent}  `;
}

/** A string can be shown as plain text if it has content and nothing JSX would read as markup. */
const isPlainText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && !/[{}<>"\\&]/.test(value);

export type MockableFunction = ((...args: any[]) => any) & { getMockName?: () => string };

export const getFunctionName = (fn: MockableFunction) => {
  const name = fn.getMockName?.() ?? fn.name;
  return name && name !== 'spy' ? name : '() => {}';
};

const isElement = (value: unknown): value is { type: unknown } =>
  typeof value === 'object' && value !== null && '$$typeof' in value && 'type' in value;

const elementName = (type: unknown): string => {
  if (typeof type === 'string') {
    return type;
  }
  const component = type as { displayName?: string; name?: string } | null;
  return component?.displayName ?? component?.name ?? 'Component';
};

const isIdentifier = (key: string) => /^[A-Za-z_$][\w$]*$/.test(key);

/** Prints an arg value as the JS expression it would be written as. */
export const valueToString = (value: unknown, depth = 0): string => {
  if (typeof value === 'function') {
    return getFunctionName(value as MockableFunction);
  }
  if (isElement(value)) {
    return `<${elementName(value.type)} />`;
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return depth > 3
      ? '[…]'
      : `[${value.map((item) => valueToString(item, depth + 1)).join(', ')}]`;
  }
  if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
    if (depth > 3) {
      return '{…}';
    }
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${isIdentifier(key) ? key : JSON.stringify(key)}: ${valueToString(item, depth + 1)}`
    );
    return entries.length ? `{ ${entries.join(', ')} }` : '{}';
  }
  return JSON.stringify(value) ?? String(value);
};

/** Convert a {key: value} pair into a JSX attribute, eg. {label: "Click"} => label="Click" */
const argToProp = (key: string, value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (value === true) {
    return key;
  }
  if (typeof value === 'string' && !/["\\\n]/.test(value)) {
    return `${key}="${value}"`;
  }
  return `${key}={${valueToString(value)}}`;
};
