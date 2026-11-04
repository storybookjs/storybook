// How the Svelte snippet prints one arg value in each place it prints one. The story-docs
// provider prints the static snippet with these, and `printHole` a value a control changed, so the
// two print a value alike. The callers say what the value is: the provider from the code the
// story writes, `printHole` from the value itself.

// Where a hole of a story's template stands: the story-docs provider writes the holes and
// `printHole` prints a changed value for them. A `name` is left out where it is the hole's arg.
export type SvelteHolePlace =
  // One prop a `{...args}` spread passes, left out while its arg is unset.
  | { kind: 'prop' }
  // The args a control set, as a spread passes them, but those `except` names: the props the spread
  // passes already, and what the element and the template parameter take themselves. They stand
  // `separator` apart, as the props of the spread do.
  | { kind: 'props'; except: string[]; separator: string }
  // An attribute a later `{...args}` spread writes over.
  | { kind: 'spreadattr' }
  // After an attribute that reads other args, before an `{...args}` spread that writes over it once
  // a control sets the arg it names. It prints nothing: the holes of the reads print the attribute.
  | { kind: 'overwritten' }
  // A read of an arg, or of the member `path` of it, in code.
  | { kind: 'value'; path?: string[] }
  // A shorthand property, `{ name }`, that reads an arg.
  | { kind: 'property'; name?: string }
  | WholeReadPlace;

// An expression tag that is one whole read of an arg, or of the member `path` of it, printed by
// `printWholeRead`: the value of the attribute `name`, a quoted attribute value, a text node, or
// other code.
export type WholeReadPlace = (
  | { kind: 'attrvalue'; name?: string; before: string; after: string }
  | { kind: 'quoted' | 'fragment' | 'code'; before: string; after: string }
) & { path?: string[] };

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

// The accessors of a read of the member `keys` of a value, such as `.user.name` or `["b-c"]`.
export const printAccessors = (keys: string[]) =>
  keys
    .map((key) => (/^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`))
    .join('');

// A whole read of `arg` whose code is `read`: a `string` it holds as text where its place shows
// that text as written, else the code between `before` and `after`.
export function printWholeRead(
  place: WholeReadPlace,
  arg: string,
  read: string,
  string: string | undefined
): string {
  const text = string?.trim() ? string : undefined;
  const code = `${place.before}${read}${place.after}`;
  switch (place.kind) {
    case 'attrvalue':
      // `title={args.title}` and `{title}` print a string as a spread prints it: `title="Save"`.
      return text !== undefined && isPlain(text) ? `${place.name ?? arg}="${text}"` : code;
    case 'quoted':
      return text !== undefined && !/[{}]/.test(text) ? escapeAttribute(text) : code;
    case 'fragment':
      return text !== undefined && !/[{}<>"\\&]/.test(text) ? text : code;
    case 'code':
      return code;
  }
}
