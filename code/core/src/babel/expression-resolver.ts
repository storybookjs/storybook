import type * as t from '@babel/types';

/** Recursively unwraps TypeScript type annotation expressions (as X, satisfies X, <X>expr). */
export const unwrapTSExpression = (expr: t.Expression | t.Declaration): t.Expression => {
  if (
    expr.type === 'TSAsExpression' ||
    expr.type === 'TSSatisfiesExpression' ||
    expr.type === 'TSTypeAssertion'
  ) {
    return unwrapTSExpression(
      (expr as t.TSAsExpression | t.TSSatisfiesExpression | t.TSTypeAssertion).expression
    );
  }
  return expr as t.Expression;
};

/**
 * Resolves an expression through variable references and TypeScript type annotations. Handles:
 * Identifier (variable lookup), TSAsExpression, TSSatisfiesExpression, TSTypeAssertion. Limits
 * recursion depth to prevent infinite loops on circular variable references.
 */
export const resolveExpression = (
  expr: t.Expression | t.Declaration | null | undefined,
  ast: t.File,
  depth = 0,
  maxDepth = 10
): t.Expression | null => {
  if (!expr || depth > maxDepth) {
    return null;
  }
  const unwrapped = unwrapTSExpression(expr as t.Expression | t.Declaration);
  if (unwrapped.type !== 'Identifier') {
    return unwrapped;
  }
  const varName = (unwrapped as t.Identifier).name;
  let declarator: t.VariableDeclarator | undefined;
  for (const node of ast.program.body) {
    let declarations: t.VariableDeclarator[] | undefined;
    if (node.type === 'VariableDeclaration') {
      declarations = node.declarations;
    } else if (
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.type === 'VariableDeclaration'
    ) {
      declarations = node.declaration.declarations;
    }
    if (declarations) {
      declarator = declarations.find(
        (d) => d.id.type === 'Identifier' && (d.id as t.Identifier).name === varName
      );
      if (declarator) {
        break;
      }
    }
  }
  if (!declarator?.init) {
    return unwrapped;
  }
  return resolveExpression(declarator.init, ast, depth + 1, maxDepth);
};
