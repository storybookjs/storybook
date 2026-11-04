import type { HoleRef } from 'storybook/internal/docs-tools';

// How a React story snippet prints one arg's value in each place it can stand. The story-docs
// provider prints the static snippet with these from the story's code, and the preview's
// `printHole` prints a changed value with them, so the two print every value alike. Imported by
// both, so it stays free of anything that only runs on the server.

// An arg's value as the printers read it: a boolean, a string with the code that writes it, JSX,
// or any other code. `code` is already indented for the place it is printed in.
export type JsxValue =
  | { kind: 'boolean'; value: boolean }
  | { kind: 'string'; value: string; code: string }
  | { kind: 'jsx'; code: string }
  | { kind: 'code'; code: string };

// Where a hole of a React template stands, which the provider writes and `printHole` fills:
//
// - `attr`: the attribute `name`, which is the arg's own unless given, left out while it is unset.
// - `text`: the arg as content.
// - `value`: the arg as an expression.
// - `attrs`: the args a control set, as attributes, but those the element writes already, named in
//   `except`.
export type ReactHolePlace =
  | { kind: 'attr'; name?: string }
  | { kind: 'text' }
  | { kind: 'value' }
  | { kind: 'attrs'; except: string[] };

// Wraps the text a place prints in its hole, for the template; the snippet prints the text.
export type Mark = (hole: HoleRef<ReactHolePlace>, text: string) => string;

const unmarked: Mark = (_, text) => text;

const isAttributeName = (name: string) => /^[A-Za-z_][A-Za-z0-9_:-]*$/.test(name);

// JSX has no escapes in an attribute string, and decodes entities and folds line breaks in it.
const isAttributeText = (text: string) => !/["&\r\n]/.test(text);

// JSX text cannot hold braces or tags, and decodes entities and folds line breaks in it.
const isChildText = (text: string) => !/[{}<>&\r\n]/.test(text);

const valueCode = (value: JsxValue) =>
  value.kind === 'boolean' ? String(value.value) : value.code;

// One attribute: bare while `true`, a string it can hold quoted, anything else as code.
export const printAttribute = (name: string, value: JsxValue) => {
  if (value.kind === 'boolean') {
    return value.value ? name : `${name}={false}`;
  }
  return value.kind === 'string' && isAttributeText(value.value)
    ? `${name}="${value.value}"`
    : `${name}={${value.code}}`;
};

// The attributes for the args, with those no attribute can be named after in a spread at the end.
// `mark` wraps each in an `attr` hole, or each value in the spread in a `value` hole.
export const printAttributes = (args: [string, JsxValue][], mark = unmarked) => {
  const unnamed = args.filter(([name]) => !isAttributeName(name));
  const attributes = args
    .filter(([name]) => isAttributeName(name))
    .map(([name, value]) => mark({ kind: 'attr', arg: name }, printAttribute(name, value)));
  if (unnamed.length !== 0) {
    const members = unnamed.map(
      ([name, value]) =>
        `${JSON.stringify(name)}: ${mark({ kind: 'value', arg: name }, valueCode(value))}`
    );
    attributes.push(`{...{ ${members.join(', ')} }}`);
  }
  return attributes;
};

// Content: a string JSX text can hold as it is, JSX as it is, anything else as an expression.
export const printChildren = (value: JsxValue) => {
  if (value.kind === 'string' && isChildText(value.value)) {
    return value.value;
  }
  return value.kind === 'jsx' ? value.code : `{${valueCode(value)}}`;
};

// The args a bound story is called with, one a line, each as its code.
export const printArgsObject = (args: [string, string][]) =>
  args.length === 0
    ? '{}'
    : `{\n${args.map(([name, code]) => `    ${JSON.stringify(name)}: ${code}`).join(',\n')}\n}`;
