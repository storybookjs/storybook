import { type NodePath, types as t } from 'storybook/internal/babel';

import type { CsfFile } from '../CsfFile.ts';
import type { RenderFunctionPath } from './render.ts';

type StaticIdentifierMemberCall = t.CallExpression & {
  callee: t.MemberExpression & { object: t.Identifier; property: t.Identifier };
};

/** Peels TS assertion/satisfies wrappers and parentheses off an expression node. */
export const unwrapExpression = (node: t.Node): t.Node =>
  t.isTSAsExpression(node) ||
  t.isTSSatisfiesExpression(node) ||
  t.isTSNonNullExpression(node) ||
  t.isTSTypeAssertion(node) ||
  t.isParenthesizedExpression(node)
    ? unwrapExpression(node.expression)
    : node;

export const isCanonicalCsf2BindCall = (node: t.Node): node is StaticIdentifierMemberCall =>
  t.isCallExpression(node) &&
  t.isMemberExpression(node.callee) &&
  !node.callee.computed &&
  t.isIdentifier(node.callee.object) &&
  t.isIdentifier(node.callee.property, { name: 'bind' }) &&
  (node.arguments.length === 0 ||
    (node.arguments.length === 1 &&
      t.isObjectExpression(node.arguments[0]) &&
      node.arguments[0].properties.length === 0));

export const isCsfFactoryCall = (node: t.Node): node is StaticIdentifierMemberCall =>
  t.isCallExpression(node) &&
  t.isMemberExpression(node.callee) &&
  !node.callee.computed &&
  t.isIdentifier(node.callee.object) &&
  t.isIdentifier(node.callee.property) &&
  (node.callee.property.name === 'story' || node.callee.property.name === 'extend');

/**
 * Static key of an object member, or `null` when it is computed from something else.
 *
 * A computed key written as a string literal is static: `{ ['args']: … }` names the same member as
 * `{ args: … }`, so it reads as that name rather than as a key only running the story would produce.
 */
export const keyOf = (p: t.ObjectMethod | t.ObjectProperty): string | null =>
  t.isStringLiteral(p.key) ? p.key.value : !p.computed && t.isIdentifier(p.key) ? p.key.name : null;

/** Value of an object expression's own property, when it has one. */
export const propertyValue = (
  object: t.ObjectExpression | undefined | null,
  name: string
): t.Node | undefined =>
  object?.properties.find(
    (candidate): candidate is t.ObjectProperty =>
      t.isObjectProperty(candidate) && keyOf(candidate) === name
  )?.value;

/** Expression a block body consists of, when it consists of exactly `return <expression>`. */
const soleReturnedExpression = (body: t.BlockStatement): t.Expression | undefined => {
  const [statement, ...rest] = body.body;
  return rest.length === 0 && t.isReturnStatement(statement) && t.isExpression(statement.argument)
    ? statement.argument
    : undefined;
};

/**
 * Expression a function returns directly, covering the concise body (`() => …`) and a block body
 * that is only a `return`.
 *
 * A block body must hold nothing but that `return`, since any extra statement could change what the
 * expression evaluates to and a static reader cannot follow it.
 */
export const returnedExpression = (fn: t.Node | undefined): t.Expression | undefined => {
  if (!t.isFunction(fn)) {
    return undefined;
  }

  return t.isExpression(fn.body) ? fn.body : soleReturnedExpression(fn.body);
};

/** {@link returnedExpression} as a path, for callers that resolve identifiers against scope. */
export const returnedExpressionPath = (
  renderFunction: RenderFunctionPath
): NodePath<t.Expression> | undefined => {
  if (!returnedExpression(renderFunction.node)) {
    return undefined;
  }

  const body = renderFunction.get('body');
  if (body.isExpression()) {
    return body;
  }

  const [statement] = body.isBlockStatement() ? body.get('body') : [];
  const argument = statement?.isReturnStatement() ? statement.get('argument') : undefined;
  return argument?.isExpression() ? argument : undefined;
};

/**
 * Object literal a render function resolves to, following a local identifier when it returns one.
 *
 * @example `() => ({ template })` and `() => config` with `const config = { template }` both →
 * that object literal
 */
export const resolveReturnedObjectExpression = (
  renderFunction: RenderFunctionPath
): t.ObjectExpression | undefined => {
  const returned = returnedExpressionPath(renderFunction);

  if (returned?.isObjectExpression()) {
    return returned.node;
  }
  if (!returned?.isIdentifier()) {
    return undefined;
  }

  const resolved = resolveIdentifierInit(renderFunction, returned);
  return resolved?.isObjectExpression() ? resolved.node : undefined;
};

/** Resolve a local story helper used by `Template.bind({})` or `render: Template`. */
export function resolveIdentifierInit(
  storyPath: NodePath<t.Node>,
  identifier: NodePath<t.Identifier>
): NodePath<t.FunctionDeclaration> | NodePath<t.Expression> | null {
  const programPath = storyPath.findParent((p) => p.isProgram()) as NodePath<t.Program> | null;

  if (!programPath) {
    return null;
  }

  for (const stmt of programPath.get('body')) {
    if (stmt.isFunctionDeclaration() && stmt.node.id?.name === identifier.node.name) {
      return stmt;
    }
    if (stmt.isExportNamedDeclaration()) {
      const decl = stmt.get('declaration');
      if (decl.isFunctionDeclaration() && decl.node.id?.name === identifier.node.name) {
        return decl;
      }
    }
  }

  const declarators = programPath.get('body').flatMap((stmt) => {
    if (stmt.isVariableDeclaration()) {
      return stmt.get('declarations');
    }
    if (stmt.isExportNamedDeclaration()) {
      const decl = stmt.get('declaration');

      if (decl && decl.isVariableDeclaration()) {
        return decl.get('declarations');
      }
    }
    return [];
  });

  const match = declarators.find((d) => {
    const id = d.get('id');
    return id.isIdentifier() && id.node.name === identifier.node.name;
  });

  if (!match) {
    return null;
  }
  const init = match.get('init');
  return init && init.isExpression() ? init : null;
}

/** NodePath for a known node inside a program. */
export function pathForNode<T extends t.Node>(
  program: NodePath<t.Program>,
  target: T | undefined
): NodePath<T> | undefined {
  if (!target) {
    return undefined;
  }
  let found: NodePath<T> | undefined;

  program.traverse({
    enter(p) {
      if (p.node && p.node === target) {
        found = p as NodePath<T>;
        p.stop();
      }
    },
  });

  return found;
}

/** ObjectExpression path for the parsed CSF default meta, when available. */
export function metaObjectPath(csf: CsfFile): NodePath<t.ObjectExpression> | undefined {
  const metaPath = pathForNode(csf._file.path, csf._metaNode);

  return metaPath?.isObjectExpression() ? metaPath : undefined;
}
