import { types as t } from 'storybook/internal/babel';
import { sourceOf } from 'storybook/internal/csf-tools';
import { ARG_PATH_PATTERN } from 'storybook/internal/docs-tools';

import type { HtmlTemplate, TemplateScope } from './template-scope.ts';
import { argReferenceForExpression } from './template-scope.ts';

const ARG_PATH = new RegExp(ARG_PATH_PATTERN);

// The live `template` that `../../docs/template-format.ts` describes, or `undefined` when a hole
// reads the args in a way the filler cannot follow or no hole reads them at all.
export function templateSource({
  expressions,
  lit,
  quasis,
  scope,
}: HtmlTemplate): string | undefined {
  // A string template renders as `innerHTML`, which lit's bindings do not describe.
  if (!lit) {
    return undefined;
  }
  const holes = expressions.map((expression) => normalizeExpression(expression, scope));
  if (holes.some((hole) => hole === undefined) || !holes.some((hole) => ARG_PATH.test(hole!))) {
    return undefined;
  }
  return dedent(
    quasis.reduce((source, quasi, index) => `${source}\${${holes[index - 1]}}${quasi}`)
  );
}

// Without the indentation the html has in the story file, as its lines after the first share it.
const dedent = (source: string) => {
  const lines = source.trim().split('\n');
  const indents = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => /^[ \t]*/.exec(line)![0].length);
  const indent = Math.min(...indents);
  return lines.map((line, index) => (index === 0 ? line : line.slice(indent))).join('\n');
};

const argPathNode = ({ name, path }: { name: string; path: string[] }): t.Expression =>
  [name, ...path].reduce<t.Expression>(
    (object, key) =>
      t.isValidIdentifier(key)
        ? t.memberExpression(object, t.identifier(key))
        : t.memberExpression(object, t.stringLiteral(key), true),
    t.identifier('args')
  );

// The expression with every arg it reads written as `args.name`; `undefined` when it reads them
// another way, such as passing them along whole or binding an arg's name again, or when the filler
// could not read it back.
export function normalizeExpression(
  expression: t.Expression,
  scope: TemplateScope
): string | undefined {
  const argNames = new Set(['args', ...scope.params, ...scope.aliases.keys()]);
  let failed = false;

  const rebinds = (node: t.Node) =>
    Object.keys(t.getBindingIdentifiers(node)).some((name) => argNames.has(name));

  const visit = (node: t.Node): t.Node => {
    if (t.isExpression(node)) {
      const reference = argReferenceForExpression(node, scope);
      if (reference) {
        return argPathNode(reference);
      }
      if (t.isIdentifier(node)) {
        const alias = scope.aliases.get(node.name);
        if (alias?.kind === 'value') {
          return t.valueToNode(alias.value);
        }
        failed ||= argNames.has(node.name);
        return node;
      }
    }
    if (
      (t.isFunction(node) && node.params.some(rebinds)) ||
      t.isVariableDeclarator(node) ||
      t.isFunctionDeclaration(node) ||
      t.isClassDeclaration(node) ||
      t.isCatchClause(node)
    ) {
      failed ||= rebinds(t.isCatchClause(node) ? (node.param ?? node) : node);
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      if (isNonReferenceKey(node, key)) {
        continue;
      }
      const record = node as unknown as Record<string, unknown>;
      const child = record[key];
      if (Array.isArray(child)) {
        record[key] = child.map((entry) => (t.isNode(entry) ? visit(entry) : entry));
      } else if (t.isNode(child)) {
        record[key] = visit(child);
      }
    }
    if (t.isObjectProperty(node) && node.shorthand && !t.isIdentifier(node.value)) {
      node.shorthand = false;
    }
    return node;
  };

  const normalized = visit(t.cloneNode(expression, true));
  return failed || !isFillable(normalized) ? undefined : sourceOf(normalized);
}

// The filler reads a hole as text: a regex literal can hide where the hole ends, and an arg path
// written in a string would be filled.
const isFillable = (node: t.Node) => {
  let fillable = true;
  t.traverseFast(node, (child) => {
    fillable &&= !(
      t.isRegExpLiteral(child) ||
      (t.isStringLiteral(child) && ARG_PATH.test(child.value)) ||
      (t.isTemplateElement(child) && ARG_PATH.test(child.value.raw))
    );
  });
  return fillable;
};

const isNonReferenceKey = (node: t.Node, key: string) =>
  ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    key === 'property' &&
    !node.computed) ||
  ((t.isObjectProperty(node) || t.isObjectMethod(node) || t.isClassProperty(node)) &&
    key === 'key' &&
    !node.computed);
