/**
 * Static Angular template snippets, built from a component's Compodoc metadata and a story's
 * declared args without loading a single Angular class.
 *
 * The browser generator (`client/renderer/ComputesTemplateFromComponent.ts`) reads the loaded
 * component class through Angular's reflection APIs, which do not work in Node: `ɵcmp` is only
 * populated by the Angular compiler. This module reimplements its rules against Compodoc's
 * `documentation.json` instead. It is deliberately not shared with the browser copy - one runs
 * against runtime classes, the other against JSON.
 *
 * ## v1 scope and known limitations
 *
 * - **Property and event bindings only.** Structural directives (`*ngIf`, `*ngFor`), two-way
 *   banana-in-a-box syntax (`[(x)]`) and content projection (`<ng-content>`) are out of scope. An
 *   Angular `model()` is emitted as a separate `[x]` input plus an `(xChange)` output, which is
 *   what the two-way form desugars to.
 * - **Args the component does not declare as an input or an output are dropped.** The binding set
 *   is decided by Compodoc's metadata, not by the arg's runtime type, so a function passed to an
 *   `@Input` stays a property binding.
 * - **Functions and `undefined` are printed literally**, as source text. Angular template
 *   expressions cannot contain function literals, so a function-valued input produces a snippet
 *   that reads correctly but would not compile as written.
 * - **Values are read statically from the story file**, so an arg whose value is an identifier or
 *   a call expression is printed as that expression rather than as the value it evaluates to.
 * - **CSF2 `Story.args = {}` assignments are not read**; only args declared on the meta or on the
 *   story's own config object are.
 * - **The snippet no longer updates as Controls change.** That is the one accepted regression of
 *   the server-side docs path.
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
  /**
   * Source text of `args` spread elements. A spread carries values no static pass can resolve, so
   * it is reported in the snippet rather than dropped without trace.
   */
  unresolvedArgs?: readonly string[];
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

const IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Property name as it can be referenced from a template: dot notation when the name is a valid
 * identifier, bracket notation otherwise.
 */
export const formatPropInTemplate = (propertyName: string): string =>
  IDENTIFIER.test(propertyName) ? propertyName : `this['${propertyName}']`;

/**
 * First selector of a comma-separated list, ignoring commas inside `[...]` or a quoted attribute
 * value. Angular matches a component on any one of its selectors, so the first is as good as any.
 */
const firstSelector = (selector: string): string => {
  let inAttribute = false;
  let quote: string | undefined;

  for (let index = 0; index < selector.length; index++) {
    const char = selector[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '[') {
      inAttribute = true;
    } else if (char === ']') {
      inAttribute = false;
    } else if (char === ',' && !inAttribute) {
      return selector.slice(0, index);
    }
  }
  return selector;
};

/** Index just past the `]` closing the attribute that starts at `start`, quotes honoured. */
const attributeEnd = (selector: string, start: number): number => {
  let quote: string | undefined;
  for (let index = start + 1; index < selector.length; index++) {
    const char = selector[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ']') {
      return index + 1;
    }
  }
  return selector.length;
};

/** Index just past a `:pseudo` or `:pseudo(...)` run, nested parentheses and quotes honoured. */
const pseudoEnd = (selector: string, start: number): number => {
  let index = start + 1;
  while (index < selector.length && /[\w-]/.test(selector[index])) {
    index++;
  }
  if (selector[index] !== '(') {
    return index;
  }
  let depth = 0;
  let quote: string | undefined;
  for (; index < selector.length; index++) {
    const char = selector[index];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return selector.length;
};

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
 * A real scan rather than the browser copy's regex pipeline, which mangles a comma inside an
 * attribute value and pastes pseudo-selectors into the tag name (`my-cmp:not([disabled])` becomes
 * `<my-cmp:not( disabled)>`).
 *
 * A selector with no element part - a bare `[myDirective]` or `.my-class` - describes a directive,
 * which has no host element of its own. `div` is the neutral host: it is what the browser copy
 * already renders for the `.my-class` case, and it keeps the snippet copy-pasteable.
 */
export const parseSelector = (selector: string): HostElement => {
  const single = firstSelector(selector).trim();
  const attributes: string[] = [];
  const classes: string[] = [];
  let tag: string | undefined;
  let id: string | undefined;
  let index = 0;

  while (index < single.length) {
    const char = single[index];

    if (char === '[') {
      const end = attributeEnd(single, index);
      const body = single.slice(index + 1, end - 1).trim();
      if (body) {
        attributes.push(toHostAttribute(body));
      }
      index = end;
      continue;
    }
    if (char === ':') {
      // A pseudo-selector narrows when the directive applies; it is not part of the host element.
      index = pseudoEnd(single, index);
      continue;
    }
    if (char === '#' || char === '.') {
      const name = /^[\w-]+/.exec(single.slice(index + 1))?.[0];
      if (name) {
        if (char === '#') {
          id = name;
        } else {
          classes.push(name);
        }
        index += name.length + 1;
        continue;
      }
      index++;
      continue;
    }

    const element = /^[a-zA-Z][\w-]*/.exec(single.slice(index))?.[0];
    if (element && tag === undefined) {
      tag = element;
      index += element.length;
      continue;
    }
    index++;
  }

  return { tag: tag ?? 'div', id, classes, attributes };
};

/**
 * Angular reads a binding's expression out of an HTML attribute value, so `&` and `"` have to
 * survive as entities or the snippet stops being well-formed markup. Nothing else is rewritten:
 * the browser copy leaves both raw and produces a broken template for any string holding a quote.
 */
const escapeAttributeValue = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** An arg's value AST node as a single-line Angular template expression. */
export const templateExpression = (node: t.Node): string =>
  escapeAttributeValue(generate(node, { concise: true, comments: false }).code);

/** Builds the static Angular template snippet for one story. */
export const generateAngularSnippet = ({
  component,
  args,
  unresolvedArgs = [],
}: AngularSnippetInput): string => {
  if (!component.selector) {
    return `<ng-container *ngComponentOutlet="${component.name}"></ng-container>`;
  }

  const host = parseSelector(component.selector);

  const inputBindings = component.inputs
    .filter((name) => name in args)
    .map((name) => `[${name}]="${templateExpression(args[name])}"`);

  // Every output gets a handler, whether or not the story declared one: Storybook's actions
  // enhancer injects an arg for each output at runtime, which is why the browser snippet shows
  // them for stories that never mention them.
  const outputBindings = component.outputs.map(
    (name) => `(${name})="${formatPropInTemplate(name)}($event)"`
  );

  const hostAttributes = [
    ...(host.id ? [`id="${host.id}"`] : []),
    ...(host.classes.length > 0 ? [`class="${host.classes.join(' ')}"`] : []),
    ...host.attributes,
  ];

  const attributes = [...hostAttributes, ...inputBindings, ...outputBindings];
  const attributeText = attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
  const element = VOID_ELEMENTS.has(host.tag)
    ? `<${host.tag}${attributeText} />`
    : `<${host.tag}${attributeText}></${host.tag}>`;

  if (unresolvedArgs.length === 0) {
    return element;
  }
  // A spread's contents are only known at runtime. Saying so beats emitting a snippet that looks
  // complete while silently missing bindings.
  return `<!-- unresolved args: ${unresolvedArgs.join(', ')} -->\n${element}`;
};
