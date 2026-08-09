import { type NodePath, types as t } from 'storybook/internal/babel';

import type { CsfFile } from '../CsfFile.ts';

/** Static key of an object property, or `null` when computed/non-literal. */
export const keyOf = (p: t.ObjectProperty): string | null =>
  p.computed
    ? null
    : t.isIdentifier(p.key)
      ? p.key.name
      : t.isStringLiteral(p.key)
        ? p.key.value
        : null;

/** Value of an object expression's own property, when it has one. */
export const propertyValue = (
  object: t.ObjectExpression | undefined | null,
  name: string
): t.Node | undefined =>
  object?.properties.find(
    (candidate): candidate is t.ObjectProperty =>
      t.isObjectProperty(candidate) && keyOf(candidate) === name
  )?.value;

/**
 * Object literal a function returns, when it returns one directly.
 *
 * Covers the concise body (`() => ({ … })`) and a block body whose `return` carries an object
 * literal, which is the shape template-based renderers use for `render`.
 */
export const returnedObjectExpression = (
  fn: t.Node | undefined
): t.ObjectExpression | undefined => {
  if (
    !t.isArrowFunctionExpression(fn) &&
    !t.isFunctionExpression(fn) &&
    !t.isFunctionDeclaration(fn)
  ) {
    return undefined;
  }
  if (t.isObjectExpression(fn.body)) {
    return fn.body;
  }
  const returned = t.isBlockStatement(fn.body)
    ? fn.body.body.find((statement): statement is t.ReturnStatement =>
        t.isReturnStatement(statement)
      )?.argument
    : undefined;
  return t.isObjectExpression(returned) ? returned : undefined;
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
function pathForNode<T extends t.Node>(
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
