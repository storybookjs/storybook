import {
  type ESTree as E,
  type ESTreeNode as Node,
  type StoryConstants,
  calledMethodName,
  staticKey,
  oneLineTextOf,
  templateParts,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

export type ArgValue =
  | { kind: 'value'; value: unknown }
  | { kind: 'function' }
  | { kind: 'unset' }
  | { kind: 'unresolved'; source: string };
export const FAILED = Symbol('failed');

export const isFunctionNode = (node: Node): boolean =>
  node.type === 'ArrowFunctionExpression' ||
  node.type === 'FunctionExpression' ||
  node.type === 'FunctionDeclaration';

// Value of a string, number, boolean or `null` literal, or `FAILED` for any other node.
export const primitiveLiteralValue = (node: Node): unknown => {
  if (node.type !== 'Literal') {
    return FAILED;
  }
  if (['string', 'number', 'boolean'].includes(typeof node.value)) {
    return node.value;
  }
  return node.value === null && !('regex' in node) && !('bigint' in node) ? null : FAILED;
};

// With `constants`, values reading story-file constants are worked out: HTML cannot declare them.
export function evaluateArgValue(node: Node, constants?: StoryConstants): ArgValue {
  const lookup: Lookup =
    constants && constants.readBy(node).size > 0
      ? (name) => constants.declarations.get(name)?.value
      : NO_CONSTANTS;
  let value: unknown;
  try {
    value = evaluate(node, lookup);
  } catch {
    // `'a'.repeat(-1)` throws in the story too.
    value = FAILED;
  }
  if (value === FAILED) {
    const unwrapped = unwrapExpression(node);
    return isFunctionNode(unwrapped)
      ? { kind: 'function' }
      : { kind: 'unresolved', source: oneLineTextOf(node) };
  }
  if (value === undefined) {
    return { kind: 'unset' };
  }
  return { kind: 'value', value };
}
type Lookup = (name: string) => Node | undefined;

const NO_CONSTANTS: Lookup = () => undefined;

const evaluated = new WeakMap<Lookup, Map<string, unknown>>();

const READING_METHODS = new Set(
  (
    'at charAt concat endsWith includes indexOf join lastIndexOf padEnd padStart repeat ' +
    'replace replaceAll slice startsWith substring toLowerCase toUpperCase trim trimEnd trimStart'
  ).split(' ')
);

const BINARY: Record<string, (left: unknown, right: unknown) => unknown> = {
  '+': (left, right) => (left as string) + (right as string),
  '-': (left, right) => (left as number) - (right as number),
  '*': (left, right) => (left as number) * (right as number),
  '/': (left, right) => (left as number) / (right as number),
  '%': (left, right) => (left as number) % (right as number),
  '===': (left, right) => left === right,
  '!==': (left, right) => left !== right,
  '<': (left, right) => (left as number) < (right as number),
  '<=': (left, right) => (left as number) <= (right as number),
  '>': (left, right) => (left as number) > (right as number),
  '>=': (left, right) => (left as number) >= (right as number),
};

const isPrimitive = (value: unknown) => value === null || typeof value !== 'object';

const evaluate = (
  node: Node,
  lookup: Lookup = NO_CONSTANTS,
  reading: ReadonlySet<string> = new Set()
): unknown | typeof FAILED => {
  const unwrapped = unwrapExpression(node);
  const read = (child: Node) => evaluate(child, lookup, reading);
  if (unwrapped.type === 'Identifier' && !reading.has(unwrapped.name)) {
    const declared = lookup(unwrapped.name);
    if (declared) {
      let values = evaluated.get(lookup);
      if (!values) {
        values = new Map();
        evaluated.set(lookup, values);
      }
      if (!values.has(unwrapped.name)) {
        values.set(
          unwrapped.name,
          evaluate(declared, lookup, new Set([...reading, unwrapped.name]))
        );
      }
      return values.get(unwrapped.name);
    }
  }
  if (lookup !== NO_CONSTANTS) {
    const computed = readConstantExpression(unwrapped, read);
    if (computed !== FAILED) return computed;
  }
  const literal = primitiveLiteralValue(unwrapped);
  if (literal !== FAILED) return literal;
  if (unwrapped.type === 'Identifier' && unwrapped.name === 'undefined') return undefined;
  if (unwrapped.type === 'UnaryExpression' && unwrapped.operator === 'void') return undefined;
  if (
    unwrapped.type === 'UnaryExpression' &&
    (unwrapped.operator === '-' || unwrapped.operator === '+') &&
    unwrapped.argument.type === 'Literal' &&
    typeof unwrapped.argument.value === 'number'
  ) {
    return unwrapped.operator === '-' ? -unwrapped.argument.value : unwrapped.argument.value;
  }
  const parts = templateParts(unwrapped);
  if (parts && parts.expressions.length === 0) {
    return parts.quasis[0] ?? FAILED;
  }
  if (isFunctionNode(unwrapped)) return FAILED;
  if (unwrapped.type === 'ArrayExpression') return evaluateArray(unwrapped, read);
  if (unwrapped.type === 'ObjectExpression') return evaluateObject(unwrapped, read);
  return FAILED;
};

const readConstantExpression = (
  node: Node,
  read: (child: Node) => unknown
): unknown | typeof FAILED => {
  if (node.type === 'TemplateLiteral') {
    let text = node.quasis[0]?.value.cooked ?? '';
    for (const [index, expression] of node.expressions.entries()) {
      const value = read(expression);
      if (value === FAILED || !isPrimitive(value)) return FAILED;
      text += String(value) + (node.quasis[index + 1]?.value.cooked ?? '');
    }
    return text;
  }
  if (node.type === 'MemberExpression') {
    const object = read(node.object);
    const key = node.computed
      ? read(node.property)
      : node.property.type === 'Identifier'
        ? node.property.name
        : FAILED;
    if (object === FAILED || object === null || object === undefined || key === FAILED) {
      return FAILED;
    }
    if (typeof key !== 'string' && typeof key !== 'number') return FAILED;
    if (key === 'length' && (typeof object === 'string' || Array.isArray(object))) {
      return object.length;
    }
    return Object.hasOwn(Object(object), key)
      ? (object as Record<string | number, unknown>)[key]
      : FAILED;
  }
  if (node.type === 'CallExpression') {
    const method = calledMethodName(node.callee);
    const callee = unwrapExpression(node.callee);
    if (!method || !READING_METHODS.has(method) || callee.type !== 'MemberExpression') {
      return FAILED;
    }
    const receiver = read(callee.object);
    const args = node.arguments.map((argument) =>
      argument.type === 'SpreadElement' ? FAILED : read(argument)
    );
    if (
      (typeof receiver !== 'string' && !Array.isArray(receiver)) ||
      args.some((value) => value === FAILED || !isPrimitive(value))
    ) {
      return FAILED;
    }
    const fn = (receiver as unknown as Record<string, unknown>)[method];
    return typeof fn === 'function' ? fn.apply(receiver, args) : FAILED;
  }
  if (node.type === 'BinaryExpression' && Object.hasOwn(BINARY, node.operator)) {
    const left = read(node.left);
    const right = read(node.right);
    return left === FAILED || right === FAILED || !isPrimitive(left) || !isPrimitive(right)
      ? FAILED
      : BINARY[node.operator](left, right);
  }
  return FAILED;
};

const evaluateArray = (
  node: E.ArrayExpression,
  read: (child: Node) => unknown
): unknown[] | typeof FAILED => {
  const values: unknown[] = [];
  for (const element of node.elements) {
    if (element === null || element.type === 'SpreadElement') {
      return FAILED;
    }
    const value = read(element);
    if (value === FAILED) {
      return FAILED;
    }
    values.push(value);
  }
  return values;
};
const evaluateObject = (
  node: E.ObjectExpression,
  read: (child: Node) => unknown
): Record<string, unknown> | typeof FAILED => {
  const values: Record<string, unknown> = {};
  for (const property of node.properties) {
    if (
      property.type !== 'Property' ||
      property.method ||
      property.kind !== 'init' ||
      property.computed
    ) {
      return FAILED;
    }
    const key = staticKey(property);
    const value = read(property.value);
    if (key === undefined || value === FAILED) {
      return FAILED;
    }
    values[key] = value;
  }
  return values;
};
