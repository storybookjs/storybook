import * as t from '@babel/types';

export const findVarInitialization = (identifier: string, program: t.Program) => {
  let init: t.Expression = null as any;
  let declarations: t.VariableDeclarator[] = null as any;
  program.body.find((node: t.Node) => {
    if (t.isVariableDeclaration(node)) {
      declarations = node.declarations;
    } else if (t.isExportNamedDeclaration(node) && t.isVariableDeclaration(node.declaration)) {
      declarations = node.declaration.declarations;
    }

    return (
      declarations &&
      declarations.find((decl: t.Node) => {
        if (
          t.isVariableDeclarator(decl) &&
          t.isIdentifier(decl.id) &&
          decl.id.name === identifier
        ) {
          init = decl.init as t.Expression;
          return true; // stop looking
        }
        return false;
      })
    );
  });
  return init;
};
