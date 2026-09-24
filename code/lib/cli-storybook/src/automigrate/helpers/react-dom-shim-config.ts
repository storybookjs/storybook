import { types as t } from 'storybook/internal/babel';

const isDefineConfigBinding = (program: t.Program, name: string) =>
  program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) &&
      ['vite', 'vitest/config'].includes(statement.source.value) &&
      statement.specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: 'defineConfig' }) &&
          specifier.local.name === name
      )
  );

export const staticConfigObject = (
  expression: t.Expression,
  program: t.Program,
  exportIndex: number
): t.ObjectExpression | undefined => {
  if (t.isObjectExpression(expression)) return expression;
  if (
    t.isCallExpression(expression) &&
    t.isIdentifier(expression.callee) &&
    isDefineConfigBinding(program, expression.callee.name) &&
    expression.arguments.length === 1
  ) {
    const [argument] = expression.arguments;
    return t.isExpression(argument)
      ? staticConfigObject(argument, program, exportIndex)
      : undefined;
  }
  if (!t.isIdentifier(expression)) return undefined;

  const declarationIndex = program.body.findIndex(
    (statement) =>
      t.isVariableDeclaration(statement, { kind: 'const' }) &&
      statement.declarations.length === 1 &&
      t.isIdentifier(statement.declarations[0]?.id, { name: expression.name })
  );
  if (declarationIndex === -1 || declarationIndex >= exportIndex) return undefined;
  if (program.body.slice(declarationIndex + 1, exportIndex).length > 0) return undefined;
  const declaration = program.body[declarationIndex];
  if (!t.isVariableDeclaration(declaration)) return undefined;
  const initializer = declaration.declarations[0]?.init;
  return t.isExpression(initializer)
    ? staticConfigObject(initializer, program, declarationIndex)
    : undefined;
};
