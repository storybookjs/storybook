import { types as t } from 'storybook/internal/babel';
import type { ImportBinding } from 'storybook/internal/csf-tools';
import { sourceOf, unwrapExpression } from 'storybook/internal/csf-tools';

import { evaluateArgValue } from './arg-values.ts';
import type { AliasValue, HtmlTemplate, TemplateScope } from './template-scope.ts';
import {
  aliasValueForIdentifier,
  argReferenceForExpression,
  templateFromExpression,
} from './template-scope.ts';

export type HoleValue =
  | { kind: 'empty'; arg?: string }
  | { handler: string; kind: 'function'; arg?: string; source?: string }
  | { kind: 'nothing'; arg?: string }
  | { kind: 'template'; arg?: string; source?: string; template: HtmlTemplate }
  | { arg?: string; kind: 'unresolved'; source: string }
  | { kind: 'value'; arg?: string; value: unknown };

export interface HoleContext {
  bindings: Map<string, ImportBinding>;
  scope: TemplateScope;
  storyArgs: Record<string, t.Node>;
}

const TEMPLATE_TAG_SOURCES = ['lit', 'lit-html', 'lit-element'];
const IF_DEFINED_SOURCES = ['lit/directives/if-defined.js', 'lit-html/directives/if-defined.js'];

export const resolveHoleValue = (expression: t.Expression, context: HoleContext): HoleValue => {
  const expressionNode = unwrapExpression(expression);
  const alias = t.isIdentifier(expressionNode)
    ? aliasValueForIdentifier(expressionNode, context.scope)
    : undefined;
  if (alias) {
    return resolveAlias(alias, context, sourceOf(expression));
  }

  const arg = argReferenceForExpression(expression, context.scope);
  if (arg) {
    return resolveArgReference(arg, context.storyArgs[arg.name], sourceOf(expression));
  }

  const unwrapped = expressionNode;
  if (isNothingExpression(unwrapped, context.bindings)) {
    return { kind: 'nothing' };
  }
  if (isStaticLiteral(unwrapped)) {
    return { kind: 'value', value: literalValue(unwrapped) };
  }
  if (t.isFunction(unwrapped)) {
    return { handler: sourceOf(expression), kind: 'function' };
  }
  const nested = templateFromExpression(unwrapped, context.bindings, context.scope);
  if (nested) {
    return { kind: 'template', source: sourceOf(expression), template: nested };
  }
  if (isIfDefinedCall(unwrapped, context.bindings)) {
    const value = resolveHoleValue(unwrapped.arguments[0] as t.Expression, context);
    return value.kind === 'value' && value.value !== null && value.value !== undefined
      ? value
      : { kind: 'nothing', ...(value.arg ? { arg: value.arg } : {}) };
  }
  if (t.isConditionalExpression(unwrapped)) {
    const test = resolveConditionalTest(unwrapped.test, context);
    if (test.kind === 'unresolved') {
      return test;
    }
    const branch = resolveHoleValue(
      test.truthy ? unwrapped.consequent : unwrapped.alternate,
      context
    );
    return test.arg && !branch.arg ? { ...branch, arg: test.arg } : branch;
  }

  return { kind: 'unresolved', source: sourceOf(expression) };
};

export const collectReferencedArgs = (
  expression: t.Expression,
  scope: TemplateScope
): Set<string> => {
  const referenced = new Set<string>();
  const visit = (node: t.Node): void => {
    if (t.isExpression(node)) {
      const args = referencedArgsForExpression(node, scope);
      for (const arg of args) {
        referenced.add(arg);
      }
    }

    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      if (skipsReferenceChild(node, key)) {
        continue;
      }
      const child = node[key as keyof typeof node];
      if (Array.isArray(child)) {
        child.forEach((entry) => {
          if (t.isNode(entry)) {
            visit(entry);
          }
        });
      } else if (t.isNode(child)) {
        visit(child);
      }
    }
  };

  visit(expression);
  return referenced;
};

export const isTruthyAttributeValue = (value: HoleValue): boolean =>
  value.kind === 'value'
    ? Boolean(value.value)
    : value.kind === 'template' || value.kind === 'function';

export const attributeValue = (
  value: Exclude<HoleValue, { kind: 'unresolved' }>,
  context: HoleContext,
  referenced?: Set<string>
): { kind: 'unresolved'; source: string } | { kind: 'value'; value: unknown } => {
  if (value.kind === 'empty' || value.kind === 'function' || value.kind === 'nothing') {
    return { kind: 'value', value: undefined };
  }
  if (value.kind === 'value') {
    return { kind: 'value', value: value.value };
  }
  if (value.template.lit) {
    return { kind: 'unresolved', source: value.source ?? value.template.source };
  }
  const resolved = templateAttributeText(value.template, context, referenced);
  return resolved.kind === 'unresolved' ? resolved : { kind: 'value', value: resolved.text };
};

export const listenerHandler = (value: HoleValue): string =>
  value.kind === 'function' ? value.handler : '() => {}';

export const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const resolveArg = (arg: string, node: t.Node | undefined): HoleValue => {
  if (!node) {
    return { kind: 'value', arg, value: undefined };
  }
  const value = evaluateArgValue(node);
  switch (value.kind) {
    case 'function':
      return { handler: sourceOf(node), kind: 'function', arg };
    case 'unset':
      return { kind: 'value', arg, value: undefined };
    case 'unresolved':
      return { arg, kind: 'unresolved', source: value.source };
    case 'value':
      return { kind: 'value', arg, value: value.value };
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
};

const resolveAlias = (alias: AliasValue, context: HoleContext, source?: string): HoleValue => {
  switch (alias.kind) {
    case 'arg':
      return resolveArgReference(alias, context.storyArgs[alias.name], source ?? alias.source);
    case 'template':
      return { kind: 'template', source: source ?? alias.source, template: alias.template };
    case 'value':
      return { kind: 'value', value: alias.value };
    default: {
      const exhaustive: never = alias;
      return exhaustive;
    }
  }
};

const resolveArgReference = (
  reference: { name: string; path: string[] },
  node: t.Node | undefined,
  missingPathSource?: string
): HoleValue => {
  const value = resolveArg(reference.name, node);
  if (value.kind === 'function' && missingPathSource) {
    return { ...value, source: missingPathSource };
  }
  if (value.kind !== 'value' || reference.path.length === 0) {
    return value;
  }
  let current = value.value;
  for (const part of reference.path) {
    const object = current === null || current === undefined ? undefined : Object(current);
    if (object === undefined || !(part in object)) {
      return missingPathSource
        ? { arg: reference.name, kind: 'unresolved', source: missingPathSource }
        : { arg: reference.name, kind: 'empty' };
    }
    current = (object as Record<string, unknown>)[part];
  }
  if (current === undefined) {
    return missingPathSource
      ? { arg: reference.name, kind: 'unresolved', source: missingPathSource }
      : { arg: reference.name, kind: 'empty' };
  }
  return { arg: reference.name, kind: 'value', value: current };
};

const referencedArgsForExpression = (
  expression: t.Expression,
  scope: TemplateScope
): Set<string> => {
  const alias = t.isIdentifier(expression) ? aliasValueForIdentifier(expression, scope) : undefined;
  if (alias) {
    return referencedArgsForAlias(alias);
  }
  const arg = argReferenceForExpression(expression, scope);
  return arg ? new Set([arg.name]) : new Set();
};

const referencedArgsForAlias = (alias: AliasValue): Set<string> => {
  switch (alias.kind) {
    case 'arg':
      return new Set([alias.name]);
    case 'template': {
      const referenced = new Set<string>();
      for (const expression of alias.template.expressions) {
        collectReferencedArgs(expression, alias.template.scope).forEach((arg) =>
          referenced.add(arg)
        );
      }
      return referenced;
    }
    case 'value':
      return new Set();
    default: {
      const exhaustive: never = alias;
      return exhaustive;
    }
  }
};

const skipsReferenceChild = (node: t.Node, key: string): boolean =>
  (t.isMemberExpression(node) && key === 'property' && !node.computed) ||
  ((t.isObjectProperty(node) || t.isObjectMethod(node)) && key === 'key' && !node.computed);

const isNothingExpression = (expression: t.Node, bindings: Map<string, ImportBinding>): boolean =>
  t.isIdentifier(expression) &&
  isImported(expression.name, 'nothing', TEMPLATE_TAG_SOURCES, bindings);

const isStaticLiteral = (expression: t.Node): boolean =>
  t.isNullLiteral(expression) ||
  t.isStringLiteral(expression) ||
  t.isNumericLiteral(expression) ||
  t.isBooleanLiteral(expression) ||
  t.isIdentifier(expression, { name: 'undefined' }) ||
  (t.isUnaryExpression(expression) && expression.operator === 'void') ||
  (t.isTemplateLiteral(expression) && expression.expressions.length === 0);

const literalValue = (expression: t.Node): unknown => {
  if (t.isNullLiteral(expression)) {
    return null;
  }
  if (
    t.isStringLiteral(expression) ||
    t.isNumericLiteral(expression) ||
    t.isBooleanLiteral(expression)
  ) {
    return expression.value;
  }
  if (t.isIdentifier(expression, { name: 'undefined' })) {
    return undefined;
  }
  if (t.isUnaryExpression(expression) && expression.operator === 'void') {
    return undefined;
  }
  if (t.isTemplateLiteral(expression)) {
    return expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? '';
  }
  return undefined;
};

const isIfDefinedCall = (
  expression: t.Node,
  bindings: Map<string, ImportBinding>
): expression is t.CallExpression & { arguments: [t.Expression] } =>
  t.isCallExpression(expression) &&
  expression.arguments.length === 1 &&
  t.isExpression(expression.arguments[0]) &&
  t.isIdentifier(expression.callee) &&
  isImported(expression.callee.name, 'ifDefined', IF_DEFINED_SOURCES, bindings);

const resolveConditionalTest = (
  expression: t.Expression,
  context: HoleContext
): { arg?: string; kind: 'value'; truthy: boolean } | { kind: 'unresolved'; source: string } => {
  const arg = argReferenceForExpression(expression, context.scope);
  if (arg) {
    const value = resolveArgReference(arg, context.storyArgs[arg.name], sourceOf(expression));
    return value.kind === 'value' || value.kind === 'empty'
      ? { arg: arg.name, kind: 'value', truthy: value.kind === 'value' && Boolean(value.value) }
      : {
          kind: 'unresolved',
          source: value.kind === 'unresolved' ? value.source : sourceOf(expression),
        };
  }
  const unwrapped = unwrapExpression(expression);
  if (isNothingExpression(unwrapped, context.bindings)) {
    return { kind: 'value', truthy: false };
  }
  if (isStaticLiteral(unwrapped)) {
    return { kind: 'value', truthy: Boolean(literalValue(unwrapped)) };
  }
  return { kind: 'unresolved', source: sourceOf(expression) };
};

const templateAttributeText = (
  template: HtmlTemplate,
  context: HoleContext,
  referenced?: Set<string>
): { kind: 'text'; text: string } | { kind: 'unresolved'; source: string } => {
  const scopedContext = { ...context, bindings: template.bindings, scope: template.scope };
  let text = '';
  for (let index = 0; index < template.expressions.length; index += 1) {
    text += template.quasis[index] ?? '';
    const expression = template.expressions[index];
    const value = resolveHoleValue(expression, scopedContext);
    if (value.kind === 'unresolved') {
      return { kind: 'unresolved', source: value.source };
    }
    if (value.arg) {
      referenced?.add(value.arg);
    }
    const resolved = attributeValue(value, scopedContext, referenced);
    if (resolved.kind === 'unresolved') {
      return resolved;
    }
    text += resolved.value === undefined ? '' : String(resolved.value);
  }
  text += template.quasis.at(-1) ?? '';
  return { kind: 'text', text };
};

const isImported = (
  local: string,
  importName: string,
  sources: readonly string[],
  bindings: Map<string, ImportBinding>
): boolean => {
  const binding = bindings.get(local);
  return !!binding && sources.includes(binding.importId) && binding.importName === importName;
};
