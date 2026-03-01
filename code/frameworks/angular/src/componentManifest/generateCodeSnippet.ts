import { types as t } from 'storybook/internal/babel';

import type { Component, Directive, Property } from '../client/compodoc-types';

/**
 * Extract the `args` AST node from a CSF meta or story ObjectExpression.
 * Returns the ObjectExpression node for `args`, or undefined.
 */
export function extractArgsNode(
  node: t.ObjectExpression | undefined
): t.ObjectExpression | undefined {
  if (!node) {
    return undefined;
  }

  const argsProp = node.properties.find(
    (p): p is t.ObjectProperty => t.isObjectProperty(p) && keyOf(p) === 'args'
  );

  return argsProp && t.isObjectExpression(argsProp.value) ? argsProp.value : undefined;
}

/**
 * Convert an AST ObjectExpression into a plain Record<string, unknown>.
 * Only handles literal values (strings, numbers, booleans, null, arrays, nested objects).
 * Non-literal values (identifiers, functions, etc.) produce the key name as placeholder.
 */
function astObjectToRecord(node: t.ObjectExpression): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop)) {
      continue;
    }
    const key = keyOf(prop);
    if (!key) {
      continue;
    }
    result[key] = astNodeToValue(prop.value);
  }
  return result;
}

/**
 * Convert a single AST node to a JavaScript value.
 * Returns undefined for unresolvable expressions.
 */
function astNodeToValue(node: t.Node): unknown {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isNumericLiteral(node)) {
    return node.value;
  }
  if (t.isBooleanLiteral(node)) {
    return node.value;
  }
  if (t.isNullLiteral(node)) {
    return null;
  }
  if (t.isUnaryExpression(node) && node.operator === '-' && t.isNumericLiteral(node.argument)) {
    return -node.argument.value;
  }
  if (t.isArrayExpression(node)) {
    return node.elements.map((el) => (el ? astNodeToValue(el) : undefined));
  }
  if (t.isObjectExpression(node)) {
    return astObjectToRecord(node);
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  // For function expressions, arrow functions, identifiers, etc. → return undefined
  // (they can't be meaningfully serialized into an Angular template)
  return undefined;
}

/**
 * Extract the property key name from an ObjectProperty node.
 */
function keyOf(prop: t.ObjectProperty | t.ObjectMethod): string | undefined {
  if (t.isIdentifier(prop.key)) {
    return prop.key.name;
  }
  if (t.isStringLiteral(prop.key)) {
    return prop.key.value;
  }
  return undefined;
}

/**
 * Merge meta-level and story-level args AST nodes into a single record.
 */
export function mergeArgsFromAst(
  metaNode: t.ObjectExpression | undefined,
  storyAnnotations: Record<string, t.Node> | undefined
): Record<string, unknown> {
  const metaArgs = metaNode ? extractArgsNode(metaNode) : undefined;
  const storyArgsNode = storyAnnotations?.args;
  const storyArgs =
    storyArgsNode && t.isObjectExpression(storyArgsNode) ? storyArgsNode : undefined;

  const metaRecord = metaArgs ? astObjectToRecord(metaArgs) : {};
  const storyRecord = storyArgs ? astObjectToRecord(storyArgs) : {};

  return { ...metaRecord, ...storyRecord };
}

/**
 * Generate an Angular template snippet for a given story.
 *
 * Approach:
 * 1. Extract the selector from the Compodoc component data
 * 2. Use the merged args (meta + story) from the CSF AST
 * 3. Build Angular template bindings ([input], (output))
 *
 * @example
 * // Output:
 * <app-button [label]="'Click me'" [primary]="true" (onClick)="onClick($event)"></app-button>
 */
export function generateAngularSnippet(
  args: Record<string, unknown> | undefined,
  componentData: Component | Directive | undefined
): string | undefined {
  if (!componentData) {
    return undefined;
  }

  const selector = (componentData as any).selector;
  if (!selector) {
    return undefined;
  }

  // Use the first selector if multiple are provided (comma-separated)
  const primarySelector = selector.split(',')[0].trim();

  if (!args || Object.keys(args).length === 0) {
    return `<${primarySelector}></${primarySelector}>`;
  }

  // Build a Set of input and output names from Compodoc data
  const inputNames = new Set(
    (componentData.inputsClass || []).map((p: Property) => p.name)
  );
  const outputNames = new Set(
    (componentData.outputsClass || []).map((p: Property) => p.name)
  );

  const bindings: string[] = [];

  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) {
      continue;
    }

    if (outputNames.has(key) || typeof value === 'function') {
      // Event binding
      bindings.push(`(${key})="${key}($event)"`);
    } else if (inputNames.has(key) || !outputNames.has(key)) {
      // Property binding
      bindings.push(formatAngularBinding(key, value));
    }
  }

  const bindingsStr = bindings.length > 0 ? ' ' + bindings.join(' ') : '';
  return `<${primarySelector}${bindingsStr}></${primarySelector}>`;
}

/**
 * Format a single Angular property binding.
 *
 * - string → [name]="'value'"
 * - boolean/number → [name]="value"
 * - object → [name]="serialized"
 */
function formatAngularBinding(name: string, value: unknown): string {
  if (typeof value === 'string') {
    const escaped = value.replaceAll("'", String.raw`\'`);
    return `[${name}]="'${escaped}'"`;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return `[${name}]="${value}"`;
  }
  if (typeof value === 'object' && value !== null) {
    const serialized = stringifyCircular(value)
      .replaceAll("'", '\u2019')
      .replaceAll(String.raw`\"`, '\u201D')
      .replaceAll(/"([^-"]+)":/g, '$1: ')
      .replaceAll('"', "'")
      .replaceAll('\u2019', String.raw`\'`)
      .replaceAll('\u201D', String.raw`\'`)
      .split(',')
      .join(', ');
    return `[${name}]="${serialized}"`;
  }

  // Fallback: use the variable name
  return `[${name}]="${name}"`;
}

/** Stringify an object with a placeholder for circular references. */
function stringifyCircular(obj: any): string {
  const seen = new Set();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}
