import type { E, Node } from './estree/ast.ts';

// Initializer of a top-level `const`/`let`/`var` (exported or not) named `identifier`.
export const findVarInitialization = (identifier: string, program: E.Program): Node | null => {
  for (const statement of program.body) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === 'Identifier' && declarator.id.name === identifier) {
        return declarator.init;
      }
    }
  }
  return null;
};
