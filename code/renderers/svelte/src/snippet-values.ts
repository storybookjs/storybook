// How the Svelte snippet prints one arg value in each place it prints one. The story-docs
// provider prints the static snippet with these, and `printHole` a value a control changed, so the
// two print a value alike. The callers say what the value is: the provider from the code the
// story writes, `printHole` from the value itself.

// An arg a spread passes: unset, `true`, or code, which a `string` it holds may print as text.
export type PropValue = undefined | true | { string?: string; code: string };

// A string that reads the same in a quoted attribute as in an expression.
const isPlain = (value: string) => !/[{}<>"\\&\r\n\t]/.test(value);

const escapeAttribute = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

// One attribute as a `{...args}` spread prints an arg: nothing while unset, the name alone for
// `true`, a plain string quoted, and anything else as code.
export function printProp(name: string, value: PropValue): string {
  if (value === undefined) {
    return '';
  }
  if (value === true) {
    return name;
  }
  return value.string !== undefined && isPlain(value.string)
    ? `${name}="${value.string}"`
    : `${name}={${value.code}}`;
}

// An attribute a later `{...args}` spread writes over: as the spread prints it, else `undefined`.
export const printSpreadAttribute = (name: string, value: PropValue) =>
  value === undefined ? `${name}={undefined}` : printProp(name, value);

const PRIMARY = new Set([
  'Identifier',
  'ThisExpression',
  'TemplateLiteral',
  'ArrayExpression',
  'MemberExpression',
  'CallExpression',
  'Literal',
]);

// Whether code of this node type keeps its meaning wherever an `args.x` read stood, without
// parentheses. A negative number does not, nor an object literal: in `() => args.o` it would
// become a block body.
export const isPrimary = (type: string, negativeNumber: boolean) =>
  PRIMARY.has(type) && !negativeNumber;

// An arg read in code, in parentheses where it would not keep its meaning in place of the read.
export const printRead = (code: string, parentheses: boolean) => (parentheses ? `(${code})` : code);

// The text a whole read of a string prints as, where it prints text: none for a blank one.
export const readText = (value: string) => (value.trim() ? value : undefined);

// `name={args.x}` as `name="text"`, or `undefined` where it prints the read as code.
export const attributeText = (name: string, text: string | undefined) =>
  text !== undefined && isPlain(text) ? `${name}="${text}"` : undefined;

// A read in a quoted attribute value as its text, or `undefined` where it stays code.
export const quotedText = (text: string | undefined) =>
  text !== undefined && !/[{}]/.test(text) ? escapeAttribute(text) : undefined;

// A read in markup as its text, or `undefined` where it stays code.
export const fragmentText = (text: string | undefined) =>
  text !== undefined && !/[{}<>"\\&]/.test(text) ? text : undefined;
