// How a React story snippet prints one arg's value in each place it can stand. The story-docs
// provider prints the static snippet with these from the story's code, and the preview's filler
// prints a template's holes with them from the current args, so the two print every value alike.
// Imported by both, so it stays free of anything that only runs on the server.

/**
 * An arg's value as the printers read it: a boolean, a string with the code that writes it, JSX,
 * or any other code. `code` is already indented for the place it is printed in.
 */
export type JsxValue =
  | { kind: 'boolean'; value: boolean }
  | { kind: 'string'; value: string; code: string }
  | { kind: 'jsx'; code: string }
  | { kind: 'code'; code: string };

/** Whether an arg can be written as a JSX attribute of its name, or needs a spread. */
export const isAttributeName = (name: string) => /^[A-Za-z_][A-Za-z0-9_:-]*$/.test(name);

/** Whether an attribute holds a string as it is: JSX has no escapes in it, decodes entities and folds line breaks. */
export const isAttributeText = (text: string) => !/["&\r\n]/.test(text);

/** Whether content holds a string as it is: JSX text cannot hold braces or tags, decodes entities and folds line breaks. */
export const isChildText = (text: string) => !/[{}<>&\r\n]/.test(text);

/** The code of a value, as an expression prints it. */
export const valueCode = (value: JsxValue) =>
  value.kind === 'boolean' ? String(value.value) : value.code;

/** One attribute: bare while `true`, a string it can hold quoted, anything else as code. */
export const printAttribute = (name: string, value: JsxValue) => {
  if (value.kind === 'boolean') {
    return value.value ? name : `${name}={false}`;
  }
  return value.kind === 'string' && isAttributeText(value.value)
    ? `${name}="${value.value}"`
    : `${name}={${value.code}}`;
};

/** The attributes for the args, with those no attribute can be named after in a spread at the end. */
export const printAttributes = (args: [string, JsxValue][]) => {
  const unnamed = args.filter(([name]) => !isAttributeName(name));
  const attributes = args
    .filter(([name]) => isAttributeName(name))
    .map(([name, value]) => printAttribute(name, value));
  if (unnamed.length !== 0) {
    const members = unnamed.map(([name, value]) => `${JSON.stringify(name)}: ${valueCode(value)}`);
    attributes.push(`{...{ ${members.join(', ')} }}`);
  }
  return attributes;
};

/** Content: a string JSX text can hold as it is, JSX as it is, anything else as an expression. */
export const printChildren = (value: JsxValue) => {
  if (value.kind === 'string' && isChildText(value.value)) {
    return value.value;
  }
  return value.kind === 'jsx' ? value.code : `{${valueCode(value)}}`;
};

/** An element on one line, self-closing without content. */
export const printElement = (name: string, attributes: string[], children: string) => {
  const opening = [name, ...attributes].join(' ');
  return children ? `<${opening}>${children}</${name}>` : `<${opening} />`;
};

/** The end of an element with its content. */
export const printClose = (name: string, children: string) => `>${children}</${name}>`;

/** The args a bound story is called with, one a line, each as its code. */
export const printArgsObject = (args: [string, JsxValue][]) =>
  args.length === 0
    ? '{}'
    : `{\n${args.map(([name, value]) => `    ${JSON.stringify(name)}: ${valueCode(value)}`).join(',\n')}\n}`;
