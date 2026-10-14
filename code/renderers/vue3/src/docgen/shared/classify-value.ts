import { recast, type types as t } from 'storybook/internal/babel';
import { unwrapExpression } from 'storybook/internal/csf-tools';

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
  | { kind: 'unset' }
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
export const RESOLVABLE_GLOBALS = new Set([
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
  'console',
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

const NO_LOCALS: ReadonlySet<string> = new Set();

/** Classifies one CSF arg value into the single plan both the classifier and the renderer act on. */
export function classifyValue(node: t.Node): ValuePlan {
  const value = unwrapExpression(node);

  if (isUndefinedIdentifier(value)) {
    return { kind: 'unset' };
  }

  // An empty string renders nothing, which is also what the runtime source decorator does with it.
  if (isFunctionExpression(value) || isEmptyString(value)) {
    return { kind: 'omit' };
  }

  if (isInlineLiteral(value)) {
    return { kind: 'inline' };
  }

  return isResolvable(value) ? { kind: 'hoist' } : { kind: 'unrepresentable' };
}

// A node parsed from the story file reprints as its own source; one this pass built is formatted
// from the tree instead, so the indentation has to match the snippet it lands in.
export function printValue(node: t.Node): string {
  return recast.print(node, { tabWidth: 2 }).code;
}

export function isFunctionExpression<T extends t.Node>(
  node: T
): node is T & (t.ArrowFunctionExpression | t.FunctionExpression) {
  const unwrapped = unwrapExpression(node);
  return unwrapped.type === 'ArrowFunctionExpression' || unwrapped.type === 'FunctionExpression';
}

/** `args: { a: undefined }` unsets an inherited meta arg, so it renders nothing. */
function isUndefinedIdentifier(node: t.Node): boolean {
  const unwrapped = unwrapExpression(node);
  return unwrapped.type === 'Identifier' && unwrapped.name === UNDEFINED_IDENTIFIER;
}

/**
 * Whether a function arg can be hoisted without dangling references: every binding its body uses is
 * a parameter, a local declaration, or a JavaScript global.
 *
 * @example `(value) => value.toUpperCase()` → true; `(value) => formatHelper(value)` → false
 */
export function isSelfContainedFunction(node: t.Node): boolean {
  const fn = unwrapExpression(node);
  if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') {
    return false;
  }

  const locals = new Set<string>();
  if (!fn.params.every((param) => collectPatternNames(param, locals))) {
    return false;
  }

  if (fn.body.type !== 'BlockStatement') {
    return isResolvable(fn.body, locals);
  }
  return fn.body.body.every((statement) => statementIsResolvable(statement, locals));
}

/**
 * Statement forms a hoisted function body may contain; anything else reports `false` so the arg
 * falls back to the omit-with-warning path.
 */
function statementIsResolvable(statement: t.Statement, locals: Set<string>): boolean {
  switch (statement.type) {
    case 'VariableDeclaration':
      return statement.declarations.every(
        (declaration) =>
          (!declaration.init || isResolvable(declaration.init, locals)) &&
          collectPatternNames(declaration.id, locals)
      );
    case 'ReturnStatement':
      return !statement.argument || isResolvable(statement.argument, locals);
    case 'ExpressionStatement':
      return isResolvable(statement.expression, locals);
    default:
      return false;
  }
}

/**
 * Records every name a binding pattern introduces; default values must themselves resolve.
 *
 * @example `({ a, b = 1 }, ...rest)` → adds `a`, `b`, `rest`
 */
export function collectPatternNames(pattern: t.Node, into: Set<string>): boolean {
  switch (pattern.type) {
    case 'Identifier':
      into.add(pattern.name);
      return true;
    case 'AssignmentPattern':
      return isResolvable(pattern.right, into) && collectPatternNames(pattern.left, into);
    case 'RestElement':
      return collectPatternNames(pattern.argument, into);
    case 'ObjectPattern':
      return pattern.properties.every((property) =>
        property.type === 'RestElement'
          ? collectPatternNames(property.argument, into)
          : collectPatternNames(property.value, into)
      );
    case 'ArrayPattern':
      return pattern.elements.every((element) => !element || collectPatternNames(element, into));
    default:
      return false;
  }
}

function isEmptyString(node: t.Node): boolean {
  const value = unwrapExpression(node);
  return value.type === 'StringLiteral' && value.value === '';
}

/** Values whose printed form is self-contained, so a template expression can carry them directly. */
function isInlineLiteral(node: t.Node): boolean {
  const value = unwrapExpression(node);

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
function isResolvable(node: t.Node, locals: ReadonlySet<string> = NO_LOCALS): boolean {
  const value = unwrapExpression(node);
  const resolves = (child: t.Node): boolean => isResolvable(child, locals);

  switch (value.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
    case 'RegExpLiteral':
      return true;

    case 'Identifier':
      return locals.has(value.name) || RESOLVABLE_GLOBALS.has(value.name);

    case 'TemplateLiteral':
      return value.expressions.every(resolves);

    case 'ArrayExpression':
      return value.elements.every((element) => !element || resolves(element));

    case 'ObjectExpression':
      return value.properties.every((property) => {
        if (property.type !== 'ObjectProperty') {
          // SpreadElement hides its contents; ObjectMethod bodies can reference anything.
          return false;
        }
        return (!property.computed || resolves(property.key)) && resolves(property.value);
      });

    case 'CallExpression':
    case 'NewExpression':
      return resolves(value.callee) && value.arguments.every(resolves);

    case 'MemberExpression':
      return resolves(value.object) && (!value.computed || resolves(value.property));

    case 'UnaryExpression':
      return resolves(value.argument);

    case 'BinaryExpression':
      return resolves(value.left) && resolves(value.right);

    default:
      return false;
  }
}
