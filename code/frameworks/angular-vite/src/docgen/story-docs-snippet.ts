/**
 * Server-side renderer for Angular story snippets. The binding grammar and value formatting mirror
 * the runtime generator (`client/renderer/ComputesTemplateFromComponent.ts`) so static service
 * snippets read like what the preview's source decorator emits. The relevant pieces are duplicated
 * rather than imported: the runtime module reads decorator metadata through `@angular/core`, which
 * must not load in the dev-server process.
 */

/** An arg value that could not be evaluated statically; its source text is inlined verbatim. */
export class RawArgExpression {
  constructor(public readonly text: string) {}
}

export interface SnippetInputBinding {
  /** Template (binding) name of the input. */
  name: string;
  /** Evaluated arg value, or a {@link RawArgExpression} carrying the arg's source text. */
  value: unknown;
}

export interface RenderComponentSnippetInput {
  selector: string;
  inputs: SnippetInputBinding[];
  /** Template (binding) names of the outputs to bind, `model()` outputs already `Change`-suffixed. */
  outputs: string[];
}

export const isValidIdentifier = (name: string): boolean => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);

const formatPropInTemplate = (propertyName: string) =>
  isValidIdentifier(propertyName) ? propertyName : `this['${propertyName}']`;

/** Stringify an object with a placeholder in the circular references. */
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

const formatInputValue = (value: unknown): string => {
  if (value instanceof RawArgExpression) {
    return value.text;
  }
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

/** Fallback for components without a selector, matching the runtime generator's output. */
export const renderComponentOutletSnippet = (componentName: string): string =>
  `<ng-container *ngComponentOutlet="${componentName}"></ng-container>`;

/** Which arg names a binding list covers, mirroring `argsToTemplate`'s own options. */
export interface BindingFilter {
  include?: readonly string[];
  exclude?: readonly string[];
}

const inputBindings = (inputs: SnippetInputBinding[], allowed: (name: string) => boolean) =>
  inputs
    .filter(({ name }) => allowed(name))
    .map(({ name, value }) => `[${name}]="${formatInputValue(value)}"`);

const outputBindings = (outputs: string[], allowed: (name: string) => boolean) =>
  outputs.filter(allowed).map((name) => `(${name})="${formatPropInTemplate(name)}($event)"`);

const anyName = () => true;

/**
 * The property and event bindings on their own, without the surrounding element.
 *
 * This is what `argsToTemplate(args)` expands to at runtime, except that values are inlined rather
 * than referenced by name, so the result stands alone without the story's `props: args`.
 */
export const bindingAttributes = (
  { inputs, outputs }: Omit<RenderComponentSnippetInput, 'selector'>,
  filter: BindingFilter = {}
): string[] => {
  const allowed = (name: string) =>
    filter.include ? filter.include.includes(name) : !filter.exclude?.includes(name);
  return [...inputBindings(inputs, allowed), ...outputBindings(outputs, allowed)];
};

/** One story's template snippet: `<selector [input]="value" (output)="output($event)">…`. */
export const renderComponentSnippet = ({
  selector,
  inputs,
  outputs,
}: RenderComponentSnippetInput): string => {
  const boundInputs = inputBindings(inputs, anyName);
  const boundOutputs = outputBindings(outputs, anyName);
  const templateInputs = boundInputs.length > 0 ? ` ${boundInputs.join(' ')}` : '';
  const templateOutputs = boundOutputs.length > 0 ? ` ${boundOutputs.join(' ')}` : '';
  return buildTemplate(selector, templateInputs, templateOutputs);
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

const buildTemplate = (selector: string, inputs: string, outputs: string) => {
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
          : template.replace(/([\S]+)(.*)/, `<$1$2${inputs}${outputs}></$1>`);
      },
    ],
  ];

  return templateReplacers.reduce(
    (prevSelector, [searchValue, replacer]) => prevSelector.replace(searchValue, replacer as any),
    firstSelector
  );
};
