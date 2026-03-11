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
  const declarator = ast.program.body
    .filter((n): n is t.VariableDeclaration => n.type === 'VariableDeclaration')
    .flatMap((varDecl) => varDecl.declarations)
    .find((d) => d.id.type === 'Identifier' && (d.id as t.Identifier).name === varName);
  if (!declarator?.init) {
    return unwrapped;
  }
  return resolveExpression(declarator.init, ast, depth + 1, maxDepth);
};
