// Imported by the preview renderer and by the dev-server story-docs provider, so this module must
// stay free of `@angular/core` and of any other runtime-only import.

const isValidIdentifier = (name: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);

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

// Renders an arg value as the template expression an `[input]` binding is given.
export const formatInputValue = (value: unknown): string => {
  switch (typeof value) {
    case 'string':
      return `'${value}'`;
    case 'object':
      return stringifyCircular(value)
        .replace(/'/g, '’')
        .replace(/\\"/g, '”')
        .replace(/"([^-"]+)":/g, '$1: ')
        .replace(/"/g, "'")
        .replace(/’/g, "\\'")
        .replace(/”/g, "\\'")
        .split(',')
        .join(', ');
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

export interface BuildTemplateInput {
  // Rendered bindings, each already prefixed with a space.
  inputs: string;
  outputs: string;
  innerTemplate?: string;
}

// Expands a component selector into the element a story renders, carrying its bindings.
export const buildTemplate = (
  selector: string,
  { inputs, outputs, innerTemplate = '' }: BuildTemplateInput
) => {
  const firstSelector = selector.split(',')[0];
  const templateReplacers: [
    string | RegExp,
    string | ((substring: string, ...args: any[]) => string),
  ][] = [
    [/(^.*?)(?=[,])/, '$1'],
    [/(^\..+)/, 'div$1'],
    [/(^\[.+?])/, 'div$1'],
    [/([\w[\]]+)(\s*,[\w\s-[\],]+)+/, `$1`],
    [/#([\w-]+)/, ` id="$1"`],
    [/((\.[\w-]+)+)/, (_, c) => ` class="${c.split`.`.join` `.trim()}"`],
    [/(\[.+?])/g, (_, a) => ` ${a.slice(1, -1)}`],
    [
      /([\S]+)(.*)/,
      (template, elementSelector) => {
        return voidElements.some((element) => elementSelector === element)
          ? template.replace(/([\S]+)(.*)/, `<$1$2${inputs}${outputs} />`)
          : template.replace(/([\S]+)(.*)/, `<$1$2${inputs}${outputs}>${innerTemplate}</$1>`);
      },
    ],
  ];

  return templateReplacers.reduce(
    (prevSelector, [searchValue, replacer]) => prevSelector.replace(searchValue, replacer as any),
    firstSelector
  );
};

// Fallback element for a component whose decorator declares no selector.
export const buildComponentOutletTemplate = (componentName: string): string =>
  `<ng-container *ngComponentOutlet="${componentName}"></ng-container>`;
