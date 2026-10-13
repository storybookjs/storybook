import type {
  CsfFile,
  ESTree as E,
  ESTreeNode as Node,
  ImportBinding,
  RenderFunction,
} from 'storybook/internal/csf-tools';
import {
  collectImportBindings,
  isStringLiteral,
  keyOf,
  returnedExpression,
  sourceOf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { FAILED, primitiveLiteralValue } from './arg-values.ts';

export interface HtmlTemplate {
  bindings: Map<string, ImportBinding>;
  expressions: E.Expression[];
  lit: boolean;
  quasis: string[];
  scope: TemplateScope;
  source: string;
}

export interface TemplateScope {
  aliases: AliasMap;
  args?: string;
  destructured: Map<string, string>;
}

export type AliasMap = Map<string, AliasValue>;

export type AliasValue =
  | { kind: 'arg'; name: string; path: string[]; source?: string }
  | { kind: 'template'; source?: string; template: HtmlTemplate }
  | { kind: 'value'; value: unknown };

const TEMPLATE_TAG_SOURCES = ['lit', 'lit-html', 'lit-element'];

export function resolveHtmlTemplate(
  renderFunction: RenderFunction,
  csf: CsfFile
): HtmlTemplate | undefined {
  const bindings = collectImportBindings(csf._program);
  const returned = returnedTemplateExpression(renderFunction, bindings);
  return returned
    ? templateFromExpression(unwrapExpression(returned.node), bindings, returned.scope)
    : undefined;
}

export function templateFromExpression(
  expression: Node,
  bindings: Map<string, ImportBinding>,
  scope: TemplateScope
): HtmlTemplate | undefined {
  if (isStringLiteral(expression)) {
    return {
      bindings,
      expressions: [],
      lit: false,
      quasis: [expression.value],
      scope,
      source: sourceOf(expression),
    };
  }
  if (expression.type === 'TemplateLiteral') {
    return templateFromLiteral(expression, bindings, false, scope, sourceOf(expression));
  }
  if (expression.type !== 'TaggedTemplateExpression' || expression.tag.type !== 'Identifier') {
    return undefined;
  }
  return isImported(expression.tag.name, 'html', TEMPLATE_TAG_SOURCES, bindings) ||
    isImported(expression.tag.name, 'default', TEMPLATE_TAG_SOURCES, bindings)
    ? templateFromLiteral(expression.quasi, bindings, true, scope, sourceOf(expression))
    : undefined;
}

export function aliasValueForIdentifier(
  expression: { name: string },
  scope: TemplateScope
): AliasValue | undefined {
  return scope.aliases.get(expression.name);
}

export function argReferenceForExpression(
  expression: Node,
  scope: TemplateScope
): { name: string; path: string[] } | undefined {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type === 'Identifier') {
    const alias = aliasValueForIdentifier(unwrapped, scope);
    return alias?.kind === 'arg'
      ? { name: alias.name, path: alias.path }
      : parameterArgReference(unwrapped, scope);
  }
  if (unwrapped.type !== 'MemberExpression') {
    return undefined;
  }
  const property = memberPropertyName(unwrapped);
  if (property === undefined) {
    return undefined;
  }
  if (
    scope.args &&
    unwrapped.object.type === 'Identifier' &&
    unwrapped.object.name === scope.args
  ) {
    return { name: property, path: [] };
  }
  const object = argReferenceForExpression(unwrapped.object, scope);
  return object ? { name: object.name, path: [...object.path, property] } : undefined;
}

const returnedTemplateExpression = (
  renderFunction: RenderFunction,
  bindings: Map<string, ImportBinding>
): { node: E.Expression; scope: TemplateScope } | undefined => {
  const baseScope = scopeForRenderFunction(renderFunction);
  const strict = returnedExpression(renderFunction);
  if (strict) {
    return { node: strict, scope: baseScope };
  }

  if (renderFunction.body?.type !== 'BlockStatement') {
    return undefined;
  }

  const statements = renderFunction.body.body;
  const returned = statements.at(-1);
  if (returned?.type !== 'ReturnStatement' || !returned.argument) {
    return undefined;
  }

  const scope = copyScope(baseScope);
  for (const statement of statements.slice(0, -1)) {
    if (
      statement.type !== 'VariableDeclaration' ||
      (statement.kind !== 'const' && statement.kind !== 'let')
    ) {
      return undefined;
    }
    if (!addVariableAliases(statement, scope, bindings)) {
      return undefined;
    }
  }

  return { node: returned.argument, scope };
};

const scopeForRenderFunction = (renderFunction: RenderFunction): TemplateScope => {
  const [first] = renderFunction.params;
  const scope: TemplateScope = { aliases: new Map(), destructured: new Map() };
  if (first?.type === 'Identifier') {
    scope.args = first.name;
    return scope;
  }
  if (first?.type !== 'ObjectPattern') {
    return scope;
  }
  const destructured = destructuredAliases(first, { name: '', path: [] });
  if (!destructured) {
    return scope;
  }
  for (const [local, value] of destructured) {
    scope.aliases.set(local, value);
    if (value.kind === 'arg' && value.path.length === 0) {
      scope.destructured.set(local, value.name);
    }
  }
  return scope;
};

const addVariableAliases = (
  declaration: E.VariableDeclaration,
  scope: TemplateScope,
  bindings: Map<string, ImportBinding>
): boolean => {
  for (const declarator of declaration.declarations) {
    if (!declarator.init) {
      return false;
    }
    if (declarator.id.type === 'Identifier') {
      const alias = aliasForExpression(declarator.init, scope, bindings);
      if (!alias) {
        return false;
      }
      scope.aliases.set(declarator.id.name, alias);
      continue;
    }
    if (declarator.id.type === 'ObjectPattern') {
      const source = destructureSourceForExpression(declarator.init, scope);
      if (!source) {
        return false;
      }
      const aliases = destructuredAliases(declarator.id, source);
      if (!aliases) {
        return false;
      }
      aliases.forEach((alias, name) => scope.aliases.set(name, alias));
      continue;
    }
    return false;
  }
  return true;
};

const destructureSourceForExpression = (
  expression: E.Expression,
  scope: TemplateScope
): { name: string; path: string[] } | undefined => {
  const unwrapped = unwrapExpression(expression);
  return scope.args && unwrapped.type === 'Identifier' && unwrapped.name === scope.args
    ? { name: '', path: [] }
    : argReferenceForExpression(expression, scope);
};

const aliasForExpression = (
  expression: E.Expression,
  scope: TemplateScope,
  bindings: Map<string, ImportBinding>
): AliasValue | undefined => {
  const unwrapped = unwrapExpression(expression);
  const arg = argReferenceForExpression(unwrapped, scope);
  if (arg) {
    return { kind: 'arg', source: sourceOf(expression), ...arg };
  }
  if (isStaticLiteral(unwrapped)) {
    return { kind: 'value', value: literalValue(unwrapped) };
  }
  const template = templateFromExpression(unwrapped, bindings, copyScope(scope));
  if (template) {
    return { kind: 'template', source: sourceOf(expression), template };
  }
  return undefined;
};

const destructuredAliases = (
  pattern: E.ObjectPattern,
  source: { name: string; path: string[] }
): AliasMap | undefined => {
  const aliases: AliasMap = new Map();
  for (const property of pattern.properties) {
    if (property.type !== 'Property' || property.computed) {
      return undefined;
    }
    const key = keyOf(property as unknown as E.ObjectProperty);
    if (!key) {
      return undefined;
    }
    const root =
      source.name === ''
        ? { name: key, path: [] }
        : { name: source.name, path: [...source.path, key] };
    if (property.value.type === 'Identifier') {
      aliases.set(property.value.name, { kind: 'arg', ...root });
    } else if (property.value.type === 'ObjectPattern') {
      const nested = destructuredAliases(property.value, root);
      if (!nested) {
        return undefined;
      }
      nested.forEach((alias, name) => aliases.set(name, alias));
    } else {
      return undefined;
    }
  }
  return aliases;
};

const parameterArgReference = (
  expression: { name: string },
  scope: TemplateScope
): { name: string; path: string[] } | undefined => {
  const arg = scope.destructured.get(expression.name);
  return arg ? { name: arg, path: [] } : undefined;
};

const memberPropertyName = (expression: E.MemberExpression): string | undefined => {
  if (!expression.computed && expression.property.type === 'Identifier') {
    return expression.property.name;
  }
  return expression.computed && isStringLiteral(expression.property)
    ? expression.property.value
    : undefined;
};

const templateFromLiteral = (
  literal: E.TemplateLiteral,
  bindings: Map<string, ImportBinding>,
  lit: boolean,
  scope: TemplateScope,
  source: string
): HtmlTemplate => ({
  bindings,
  expressions: literal.expressions,
  lit,
  quasis: literal.quasis.map((quasi) => quasi.value.raw),
  scope,
  source,
});

const copyScope = (scope: TemplateScope): TemplateScope => ({
  ...scope,
  aliases: new Map(scope.aliases),
  destructured: new Map(scope.destructured),
});

const isImported = (
  local: string,
  importName: string,
  sources: readonly string[],
  bindings: Map<string, ImportBinding>
): boolean => {
  const binding = bindings.get(local);
  return !!binding && sources.includes(binding.importId) && binding.importName === importName;
};

const isStaticLiteral = (expression: Node): boolean => {
  const value = primitiveLiteralValue(expression);
  return (
    (value !== FAILED && value !== null) ||
    (expression.type === 'TemplateLiteral' && expression.expressions.length === 0)
  );
};

const literalValue = (expression: Node): unknown => {
  if (expression.type === 'TemplateLiteral') {
    return expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? '';
  }
  const value = primitiveLiteralValue(expression);
  return value === FAILED ? undefined : value;
};
