/**
 * Static Angular template snippets, built from a component's Compodoc metadata and a story's
 * declared args.
 *
 * Deliberately not shared with the browser generator
 * (`client/renderer/ComputesTemplateFromComponent.ts`): that one reads a loaded component class
 * through Angular's reflection APIs, which need `ɵcmp` and therefore the compiler. See
 * `story-docs-limitations.md` for what the static path cannot do.
 */
import type { types as t } from 'storybook/internal/babel';
import { generate } from 'storybook/internal/babel';

/** The parts of an Angular component a template snippet is built from. */
export interface AngularComponentTemplate {
  /** Class name. Used for the `*ngComponentOutlet` fallback when the component has no selector. */
  name: string;
  selector?: string;
  /** Template names of the component's inputs, i.e. what `[binding]` may name. */
  inputs: readonly string[];
  /** Template names of the component's outputs, i.e. what `(binding)` may name. */
  outputs: readonly string[];
}

export interface AngularSnippetInput {
  component: AngularComponentTemplate;
  /** Declared args (meta merged with story), as the value AST nodes they were written as. */
  args: Record<string, t.Node>;
}

/** Elements HTML forbids a closing tag on. */
const VOID_ELEMENTS = new Set([
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
]);

/** The host element an Angular selector puts a component or directive on. */
export interface HostElement {
  tag: string;
  id?: string;
  classes: string[];
  /** Attributes the selector pins on the host, already in `name` or `name="value"` form. */
  attributes: string[];
}

/** A name that can be written as-is rather than through bracket notation. */
export const IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Property name as it can be referenced from a template: dot notation when the name is a valid
 * identifier, bracket notation otherwise.
 */
export const formatPropInTemplate = (propertyName: string): string =>
  IDENTIFIER.test(propertyName) ? propertyName : `this['${propertyName}']`;

/** One selector atom: an attribute, a pseudo, an element/class/id name, or any single character. */
const SELECTOR_TOKEN =
  /\[(?:[^\]'"]|'[^']*'|"[^"]*")*\]|:[\w-]+(?:\([^()]*\))?|[.#]?[a-zA-Z][\w-]*|[\s\S]/g;

/** `attr`, `attr=value` or `attr="value"` from a selector, normalised to HTML attribute syntax. */
const toHostAttribute = (body: string): string => {
  const equals = body.indexOf('=');
  if (equals === -1) {
    return body;
  }
  const name = body.slice(0, equals).trim();
  const rawValue = body.slice(equals + 1).trim();
  const value =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;
  return `${name}="${escapeAttributeValue(value)}"`;
};

/**
 * Angular selector → the host element a story snippet renders it on.
 *
 * Tokenized the way Angular's own `CssSelector.parse` does, so quotes, brackets and pseudo
 * parentheses stop being scanner state: each token consumes its own delimiters. A selector with no
 * element part (`[myDirective]`, `.my-class`) describes a directive, which has no host element of
 * its own, so `div` stands in as a neutral, copy-pasteable host.
 */
export const parseSelector = (selector: string): HostElement => {
  const attributes: string[] = [];
  const classes: string[] = [];
  let tag: string | undefined;
  let id: string | undefined;

  for (const [token] of selector.matchAll(SELECTOR_TOKEN)) {
    if (token === ',') {
      // Angular matches on any one of a comma-separated list, so the first is as good as any.
      break;
    }
    if (token.startsWith('[')) {
      const body = token.slice(1, -1).trim();
      if (body) {
        attributes.push(toHostAttribute(body));
      }
    } else if (token.startsWith('#')) {
      id = token.slice(1);
    } else if (token.startsWith('.')) {
      classes.push(token.slice(1));
    } else if (tag === undefined && /^[a-zA-Z]/.test(token)) {
      // A `:pseudo` token never matches here, so it stays out of the tag name.
      tag = token;
    }
  }

  return { tag: tag ?? 'div', id, classes, attributes };
};

// The value lands inside a double-quoted HTML attribute, so these two have to survive as entities
// or the snippet stops being well-formed markup.
const escapeAttributeValue = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** An arg's value AST node as a single-line Angular template expression. */
export const templateExpression = (node: t.Node): string =>
  escapeAttributeValue(
    // `concise` leaves newlines inside a template literal, which would break the attribute value.
    generate(node, { concise: true, comments: false }).code.replace(/\s*\n\s*/g, ' ')
  );

/** Builds the static Angular template snippet for one story. */
export const generateAngularSnippet = ({ component, args }: AngularSnippetInput): string => {
  if (!component.selector) {
    return `<ng-container *ngComponentOutlet="${component.name}"></ng-container>`;
  }

  const host = parseSelector(component.selector);

  // `hasOwn` rather than `in`: an input named after an `Object.prototype` member would otherwise
  // read the inherited function and hand a non-node to the generator.
  const boundInputs = component.inputs.filter((name) => Object.hasOwn(args, name));
  const inputBindings = boundInputs.map((name) => `[${name}]="${templateExpression(args[name])}"`);

  // Storybook's actions enhancer injects an arg for each output at runtime, so every output gets a
  // handler whether or not the story declared one.
  const outputBindings = component.outputs.map(
    (name) => `(${name})="${formatPropInTemplate(name)}($event)"`
  );

  // An attribute directive's own selector attribute is often an input too (`[appHighlight]` with
  // an `@Input() appHighlight`). Emitting both would name it twice on the same element.
  const boundNames = new Set(boundInputs);
  const hostAttributes = [
    ...(host.id ? [`id="${host.id}"`] : []),
    ...(host.classes.length > 0 ? [`class="${host.classes.join(' ')}"`] : []),
    ...host.attributes.filter((attribute) => !boundNames.has(attribute.split('=')[0])),
  ];

  const attributes = [...hostAttributes, ...inputBindings, ...outputBindings];
  const attributeText = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  return VOID_ELEMENTS.has(host.tag)
    ? `<${host.tag}${attributeText} />`
    : `<${host.tag}${attributeText}></${host.tag}>`;
};
