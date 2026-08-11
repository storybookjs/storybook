import { recast, type types as t } from 'storybook/internal/babel';

/**
 * How one arg value reaches the generated SFC.
 *
 * Closed on purpose: an expression shape that is not explicitly handled classifies as
 * `unrepresentable` rather than being printed on the assumption that it will resolve.
 */
export type ValuePlan =
  /** Printed straight into the template, needing no scope of its own. */
  | { kind: 'inline' }
  /** Hoisted into `<script setup>`, where the full JavaScript global scope applies. */
  | { kind: 'hoist' }
  /** Intentionally absent from the snippet, matching what the runtime source decorator drops. */
  | { kind: 'omit' }
  /** References something the snippet cannot declare, so rendering it would not compile. */
  | { kind: 'unrepresentable' };

/**
 * Bindings a generated snippet may reference without declaring them.
 *
 * Everything that is not an `inline` {@link ValuePlan} is hoisted into `<script setup>`, so this is
 * the JavaScript global scope rather than Vue's narrower template-expression allowlist.
 */
const RESOLVABLE_GLOBALS = new Set([
  'Array',
  'BigInt',
  'Boolean',
  'Date',
  'Error',
  'Infinity',
  'Intl',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'RegExp',
  'Set',
  'String',
  'Symbol',
  'URL',
  'URLSearchParams',
  'WeakMap',
  'WeakSet',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'undefined',
]);

const UNDEFINED_IDENTIFIER = 'undefined';

/** Classifies one CSF arg value into the single plan both the classifier and the renderer act on. */
export function classifyValue(node: t.Node): ValuePlan {
  const value = unwrapValue(node);

  // An empty string renders nothing, which is also what the runtime source decorator does with it.
  if (isFunctionExpression(value) || isUndefinedIdentifier(value) || isEmptyString(value)) {
    return { kind: 'omit' };
  }

  if (isInlineLiteral(value)) {
    return { kind: 'inline' };
  }

  return isResolvable(value) ? { kind: 'hoist' } : { kind: 'unrepresentable' };
}

export function printValue(node: t.Node): string {
  return recast.print(node).code;
}

export function unwrapValue(node: t.Node): t.Node {
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  ) {
    return unwrapValue(node.expression);
  }

  return node;
}

export function isFunctionExpression<T extends t.Node>(
  node: T
): node is T & (t.ArrowFunctionExpression | t.FunctionExpression) {
  const unwrapped = unwrapValue(node);
  return unwrapped.type === 'ArrowFunctionExpression' || unwrapped.type === 'FunctionExpression';
}

/** `args: { a: undefined }` unsets an inherited meta arg, so it renders nothing. */
export function isUndefinedIdentifier(node: t.Node): boolean {
  const unwrapped = unwrapValue(node);
  return unwrapped.type === 'Identifier' && unwrapped.name === UNDEFINED_IDENTIFIER;
}

function isEmptyString(node: t.Node): boolean {
  const value = unwrapValue(node);
  return value.type === 'StringLiteral' && value.value === '';
}

/** Values whose printed form is self-contained, so a template expression can carry them directly. */
function isInlineLiteral(node: t.Node): boolean {
  const value = unwrapValue(node);

  switch (value.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
      return true;
    case 'UnaryExpression':
      return value.operator === '-' && isInlineLiteral(value.argument);
    default:
      return false;
  }
}

/**
 * Whether every binding the expression references resolves at runtime.
 *
 * Unhandled node types report `false` rather than falling through as resolvable, so a shape this
 * function does not understand can never reach the renderer.
 *
 * @example `new Date('2020-01-01')` → true (`Date` is global); `Sizes.LARGE` → false (`Sizes` is not)
 */
function isResolvable(node: t.Node): boolean {
  const value = unwrapValue(node);

  switch (value.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
    case 'RegExpLiteral':
      return true;

    case 'Identifier':
      return RESOLVABLE_GLOBALS.has(value.name);

    case 'TemplateLiteral':
      return value.expressions.every(isResolvable);

    case 'ArrayExpression':
      return value.elements.every((element) => !element || isResolvable(element));

    case 'ObjectExpression':
      return value.properties.every((property) => {
        if (property.type !== 'ObjectProperty') {
          // SpreadElement hides its contents; ObjectMethod bodies can reference anything.
          return false;
        }
        return (!property.computed || isResolvable(property.key)) && isResolvable(property.value);
      });

    case 'CallExpression':
    case 'NewExpression':
      return isResolvable(value.callee) && value.arguments.every(isResolvable);

    case 'MemberExpression':
      return isResolvable(value.object) && (!value.computed || isResolvable(value.property));

    case 'UnaryExpression':
      return isResolvable(value.argument);

    case 'BinaryExpression':
      return isResolvable(value.left) && isResolvable(value.right);

    default:
      return false;
  }
}
