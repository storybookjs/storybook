// Imported by the preview renderer and by the dev-server story-docs provider, so this module must
// stay free of `@angular/core` and of any other runtime-only import.

export const isValidIdentifier = (name: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);

export const formatPropInTemplate = (propertyName: string) =>
  isValidIdentifier(propertyName) ? propertyName : `this['${propertyName}']`;

const stringifyCircular = (obj: unknown) => {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
};

// A string is serialized by JSON first so control characters stay escaped, then its delimiters are
// converted: the expression sits in a double-quoted binding attribute, so it is single-quoted and a
// literal double quote survives only as its entity.
const singleQuoted = (text: string): string =>
  `'${JSON.stringify(text)
    .slice(1, -1)
    .replace(/\\"/g, '"')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')}'`;

const formatJsonValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return singleQuoted(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatJsonValue).join(', ')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${isValidIdentifier(key) ? key : singleQuoted(key)}: ${formatJsonValue(item)}`
    );
    return `{${entries.join(', ')}}`;
  }
  return String(value);
};

// Renders an arg value as the template expression an `[input]` binding is given.
export const formatInputValue = (value: unknown): string => {
  switch (typeof value) {
    case 'string':
      return singleQuoted(value);
    case 'object':
      // The JSON round-trip applies `toJSON`, drops unserializable members and caps cycles, so the
      // formatter only ever sees what the legacy generator serialized.
      return formatJsonValue(JSON.parse(stringifyCircular(value)));
    default:
      return `${value}`;
  }
};

// https://www.w3.org/TR/2011/WD-html-markup-20110113/syntax.html#syntax-elements
const voidElements = [
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
];

export interface TemplateInputBinding {
  name: string;
  // The template expression the `[input]` binding is given, e.g. from `formatInputValue`.
  expression: string;
}

export interface BuildTemplateInput {
  inputs: TemplateInputBinding[];
  // Output binding names; each renders as `(name)="name($event)"`.
  outputs: string[];
  innerTemplate?: string;
}

// A selector that names no element, `.card` or `[appHighlight]`, matches a `div` in the snippet.
const LEADING_CLASS = /^\..+/;
const LEADING_ATTRIBUTE = /^\[.+?]/;

const ID = /#([\w-]+)/;
// One run of adjacent classes, `.a.b`, becomes a single class attribute.
const CLASS_RUN = /(\.[\w-]+)+/;
const ATTRIBUTE = /\[(.+?)]/g;
// The leading non-space run is the element name; whatever follows are its attributes.
const ELEMENT_AND_ATTRIBUTES = /(\S+)(.*)/;

// Expands a component selector into the element a story renders, carrying its bindings.
export const buildTemplate = (
  selector: string,
  { inputs, outputs, innerTemplate = '' }: BuildTemplateInput
) => {
  const inputBindings = inputs.map(({ name, expression }) => ` [${name}]="${expression}"`).join('');
  const outputBindings = outputs
    .map((name) => ` (${name})="${formatPropInTemplate(name)}($event)"`)
    .join('');

  const firstSelector = selector.split(',')[0];
  const withElement =
    LEADING_CLASS.test(firstSelector) || LEADING_ATTRIBUTE.test(firstSelector)
      ? `div${firstSelector}`
      : firstSelector;

  const asAttributes = withElement
    .replace(ID, ' id="$1"')
    .replace(CLASS_RUN, (classes) => ` class="${classes.split('.').join(' ').trim()}"`)
    .replace(ATTRIBUTE, ' $1');

  return asAttributes.replace(ELEMENT_AND_ATTRIBUTES, (_, element: string, attributes: string) => {
    const openingTag = `<${element}${attributes}${inputBindings}${outputBindings}`;
    return voidElements.includes(element)
      ? `${openingTag} />`
      : `${openingTag}>${innerTemplate}</${element}>`;
  });
};

// Fallback element for a component whose decorator declares no selector.
export const buildComponentOutletTemplate = (componentName: string): string =>
  `<ng-container *ngComponentOutlet="${componentName}"></ng-container>`;
