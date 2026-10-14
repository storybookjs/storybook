import { babelPrint, types as t } from 'storybook/internal/babel';
import { keyOf, returnedExpression, unwrapExpression } from 'storybook/internal/csf-tools';

type StaticValue = { kind: 'value'; value: unknown } | { kind: 'unresolved' };

function readStaticValue(node: t.Node): StaticValue {
  node = unwrapExpression(node);
  if (t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node)) {
    return { kind: 'value', value: node.value };
  }
  if (t.isNullLiteral(node)) return { kind: 'value', value: null };
  if (t.isIdentifier(node, { name: 'undefined' })) return { kind: 'value', value: undefined };
  if (t.isUnaryExpression(node) && node.operator === '-' && t.isNumericLiteral(node.argument)) {
    return { kind: 'value', value: -node.argument.value };
  }
  if (t.isArrayExpression(node)) {
    const values: unknown[] = [];
    for (const element of node.elements) {
      const result = element ? readStaticValue(element) : { kind: 'value' as const, value: null };
      if (result.kind === 'unresolved') return result;
      values.push(result.value);
    }
    return { kind: 'value', value: values };
  }
  if (t.isObjectExpression(node)) {
    const values: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (!t.isObjectProperty(property) || property.computed) return { kind: 'unresolved' };
      const key = keyOf(property);
      if (key === null) return { kind: 'unresolved' };
      const result = readStaticValue(property.value);
      if (result.kind === 'unresolved') return result;
      Object.defineProperty(values, key, { value: result.value, enumerable: true });
    }
    return { kind: 'value', value: values };
  }
  if (t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    const expression = t.cloneNode(node);
    expression.returnType = null;
    expression.typeParameters = null;
    for (const parameter of expression.params) {
      if (
        t.isIdentifier(parameter) ||
        t.isObjectPattern(parameter) ||
        t.isArrayPattern(parameter) ||
        t.isRestElement(parameter)
      ) {
        parameter.typeAnnotation = null;
      }
    }
    const value = () => undefined;
    Object.defineProperty(value, 'name', { value: babelPrint(expression) });
    return { kind: 'value', value };
  }
  if (
    t.isNewExpression(node) &&
    t.isIdentifier(node.callee, { name: 'Date' }) &&
    node.arguments.length === 1 &&
    t.isStringLiteral(node.arguments[0])
  ) {
    const value = new Date(node.arguments[0].value);
    return Number.isNaN(value.getTime()) ? { kind: 'unresolved' } : { kind: 'value', value };
  }
  return { kind: 'unresolved' };
}

function readStaticSnippet(node: t.Node, factories: ReadonlySet<string>): string | undefined {
  if (!t.isCallExpression(node) || !t.isIdentifier(node.callee) || !factories.has(node.callee.name))
    return undefined;
  const factory = node.arguments[0];
  if (!t.isFunctionExpression(factory) && !t.isArrowFunctionExpression(factory)) return undefined;
  const result = returnedExpression(factory);
  if (!t.isObjectExpression(result)) return undefined;
  for (const property of result.properties) {
    if (t.isSpreadElement(property) || keyOf(property) !== 'render') continue;
    const render = t.isObjectMethod(property) ? property : property.value;
    if (!t.isFunction(render)) return undefined;
    const body = returnedExpression(render);
    if (t.isStringLiteral(body)) return body.value;
    if (t.isTemplateLiteral(body) && body.expressions.length === 0)
      return body.quasis.map((part) => part.value.cooked ?? part.value.raw).join('');
  }
  return undefined;
}

export function readStaticArgs(
  nodes: Record<string, t.Node>,
  {
    snippetFactories = new Set<string>(),
    mockFactories = new Set<string>(),
  }: { snippetFactories?: ReadonlySet<string>; mockFactories?: ReadonlySet<string> } = {}
) {
  const args: Record<string, unknown> = {};
  const snippets: Record<string, string> = {};
  const unresolved: string[] = [];
  for (const [key, node] of Object.entries(nodes)) {
    if (
      t.isCallExpression(node) &&
      t.isIdentifier(node.callee) &&
      mockFactories.has(node.callee.name)
    )
      continue;
    const snippet = readStaticSnippet(node, snippetFactories);
    if (snippet !== undefined) {
      Object.defineProperty(snippets, key, { value: snippet, enumerable: true });
      continue;
    }
    const result = readStaticValue(node);
    if (result.kind === 'unresolved') unresolved.push(key);
    else Object.defineProperty(args, key, { value: result.value, enumerable: true });
  }
  return { args, snippets, unresolved };
}
