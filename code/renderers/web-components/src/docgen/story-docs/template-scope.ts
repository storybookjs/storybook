import { types as t } from 'storybook/internal/babel';
import type { CsfFile, ImportBinding, RenderFunctionPath } from 'storybook/internal/csf-tools';
import {
  collectImportBindings,
  keyOf,
  returnedExpressionPath,
  sourceOf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

export interface HtmlTemplate {
  bindings: Map<string, ImportBinding>;
  expressions: t.Expression[];
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
  renderFunction: RenderFunctionPath,
  csf: CsfFile
): HtmlTemplate | undefined {
  const bindings = collectImportBindings(csf._file.path);
  const returned = returnedTemplateExpression(renderFunction, bindings);
  return returned
    ? templateFromExpression(unwrapExpression(returned.node), bindings, returned.scope)
    : undefined;
}

export function templateFromExpression(
  expression: t.Node,
  bindings: Map<string, ImportBinding>,
  scope: TemplateScope
): HtmlTemplate | undefined {
  if (t.isStringLiteral(expression)) {
    return {
      bindings,
      expressions: [],
      lit: false,
      quasis: [expression.value],
      scope,
      source: sourceOf(expression),
    };
  }
  if (t.isTemplateLiteral(expression)) {
    return templateFromLiteral(expression, bindings, false, scope, sourceOf(expression));
  }
  if (!t.isTaggedTemplateExpression(expression) || !t.isIdentifier(expression.tag)) {
    return undefined;
  }
  return isImported(expression.tag.name, 'html', TEMPLATE_TAG_SOURCES, bindings) ||
    isImported(expression.tag.name, 'default', TEMPLATE_TAG_SOURCES, bindings)
    ? templateFromLiteral(expression.quasi, bindings, true, scope, sourceOf(expression))
    : undefined;
}

export function aliasValueForIdentifier(
  expression: t.Identifier,
  scope: TemplateScope
): AliasValue | undefined {
  return scope.aliases.get(expression.name);
}

export function argReferenceForExpression(
  expression: t.Expression,
  scope: TemplateScope
): { name: string; path: string[] } | undefined {
  const unwrapped = unwrapExpression(expression);
  if (t.isIdentifier(unwrapped)) {
    const alias = aliasValueForIdentifier(unwrapped, scope);
    return alias?.kind === 'arg'
      ? { name: alias.name, path: alias.path }
      : parameterArgReference(unwrapped, scope);
  }
  if (!t.isMemberExpression(unwrapped)) {
    return undefined;
  }
  const property = memberPropertyName(unwrapped);
  if (property === undefined) {
    return undefined;
  }
  if (scope.args && t.isIdentifier(unwrapped.object, { name: scope.args })) {
    return { name: property, path: [] };
  }
  if (!t.isExpression(unwrapped.object)) {
    return undefined;
  }
  const object = argReferenceForExpression(unwrapped.object, scope);
  return object ? { name: object.name, path: [...object.path, property] } : undefined;
}

const returnedTemplateExpression = (
  renderFunction: RenderFunctionPath,
  bindings: Map<string, ImportBinding>
): { node: t.Expression; scope: TemplateScope } | undefined => {
  const baseScope = scopeForRenderFunction(renderFunction);
  const strict = returnedExpressionPath(renderFunction);
  if (strict) {
    return { node: strict.node, scope: baseScope };
  }

  if (!t.isBlockStatement(renderFunction.node.body)) {
    return undefined;
  }

  const statements = renderFunction.node.body.body;
  const returned = statements.at(-1);
  if (!t.isReturnStatement(returned) || !t.isExpression(returned.argument)) {
    return undefined;
  }

  const scope = copyScope(baseScope);
  for (const statement of statements.slice(0, -1)) {
    if (
      !t.isVariableDeclaration(statement) ||
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

const scopeForRenderFunction = (renderFunction: RenderFunctionPath): TemplateScope => {
  const [first] = renderFunction.node.params;
  const scope: TemplateScope = { aliases: new Map(), destructured: new Map() };
  if (t.isIdentifier(first)) {
    scope.args = first.name;
    return scope;
  }
  if (!t.isObjectPattern(first)) {
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
  declaration: t.VariableDeclaration,
  scope: TemplateScope,
  bindings: Map<string, ImportBinding>
): boolean => {
  for (const declarator of declaration.declarations) {
    if (!t.isExpression(declarator.init)) {
      return false;
    }
    if (t.isIdentifier(declarator.id)) {
      const alias = aliasForExpression(declarator.init, scope, bindings);
      if (!alias) {
        return false;
      }
      scope.aliases.set(declarator.id.name, alias);
      continue;
    }
    if (t.isObjectPattern(declarator.id)) {
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
  expression: t.Expression,
  scope: TemplateScope
): { name: string; path: string[] } | undefined => {
  const unwrapped = unwrapExpression(expression);
  return scope.args && t.isIdentifier(unwrapped, { name: scope.args })
    ? { name: '', path: [] }
    : argReferenceForExpression(expression, scope);
};

const aliasForExpression = (
  expression: t.Expression,
  scope: TemplateScope,
  bindings: Map<string, ImportBinding>
): AliasValue | undefined => {
  const unwrapped = unwrapExpression(expression);
  const arg = t.isExpression(unwrapped) ? argReferenceForExpression(unwrapped, scope) : undefined;
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
  pattern: t.ObjectPattern,
  source: { name: string; path: string[] }
): AliasMap | undefined => {
  const aliases: AliasMap = new Map();
  for (const property of pattern.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      return undefined;
    }
    const key = keyOf(property);
    if (!key) {
      return undefined;
    }
    const root =
      source.name === ''
        ? { name: key, path: [] }
        : { name: source.name, path: [...source.path, key] };
    if (t.isIdentifier(property.value)) {
      aliases.set(property.value.name, { kind: 'arg', ...root });
    } else if (t.isObjectPattern(property.value)) {
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
  expression: t.Identifier,
  scope: TemplateScope
): { name: string; path: string[] } | undefined => {
  const arg = scope.destructured.get(expression.name);
  return arg ? { name: arg, path: [] } : undefined;
};

const memberPropertyName = (expression: t.MemberExpression): string | undefined => {
  if (!expression.computed && t.isIdentifier(expression.property)) {
    return expression.property.name;
  }
  return expression.computed && t.isStringLiteral(expression.property)
    ? expression.property.value
    : undefined;
};

const templateFromLiteral = (
  literal: t.TemplateLiteral,
  bindings: Map<string, ImportBinding>,
  lit: boolean,
  scope: TemplateScope,
  source: string
): HtmlTemplate => ({
  bindings,
  expressions: literal.expressions.filter((expression): expression is t.Expression =>
    t.isExpression(expression)
  ),
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

const isStaticLiteral = (expression: t.Node): boolean =>
  t.isStringLiteral(expression) ||
  t.isNumericLiteral(expression) ||
  t.isBooleanLiteral(expression) ||
  (t.isTemplateLiteral(expression) && expression.expressions.length === 0);

const literalValue = (expression: t.Node): unknown => {
  if (
    t.isStringLiteral(expression) ||
    t.isNumericLiteral(expression) ||
    t.isBooleanLiteral(expression)
  ) {
    return expression.value;
  }
  if (t.isTemplateLiteral(expression)) {
    return expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? '';
  }
  return undefined;
};
