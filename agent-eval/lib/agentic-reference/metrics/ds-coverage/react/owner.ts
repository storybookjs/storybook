// Which top-level declaration owns a JSX element.
//
// Owner keys feed the instantiation-multiplier graph: every element belongs to
// the nearest enclosing *top-level* statement, named exactly the way identify
// names local identities, so a usage resolving to `local { module, name }`
// lands on the bucket of the declaration that renders it. The naming rules
// mirror module-graph.ts's recordDeclaration.
//
// This is deliberately NOT node-path.ts's declarationName(): a path roots at
// the nearest named declaration for display (`render` for a class component),
// an owner is the identity usages resolve to (the class). owner.test.ts pins
// the correspondence for the common case.
import ts from 'typescript';

/** `<file>#<name>` for a declaration's bucket, `<file>#<module>` for loose JSX. */
export function ownerKey(filePath: string, name: string | null): string {
  return `${filePath}#${name ?? '<module>'}`;
}

/**
 * The identity name of the top-level statement enclosing `node`, or null when
 * no declaration owns it (loose module-level JSX, unrecognized shapes).
 */
export function ownerName(node: ts.Node): string | null {
  let statement: ts.Node | undefined;
  for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
    if (current.parent !== undefined && ts.isSourceFile(current.parent)) {
      statement = current;
      break;
    }
  }
  if (statement === undefined) return null;

  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    // Anonymous only as `export default …`; module-graph gives it the
    // 'default' local slot, so usages resolve to that name.
    return statement.name?.text ?? 'default';
  }

  if (ts.isVariableStatement(statement)) {
    // The declarator whose initializer holds the node names the owner, so
    // `const A = <a/>, B = <b/>` attributes each element to its own binding.
    for (const declaration of statement.declarationList.declarations) {
      if (node.pos >= declaration.pos && node.end <= declaration.end) {
        return ts.isIdentifier(declaration.name) ? declaration.name.text : null;
      }
    }
    return null;
  }

  if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
    return 'default';
  }

  if (
    ts.isExpressionStatement(statement) &&
    ts.isBinaryExpression(statement.expression) &&
    statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(statement.expression.left) &&
    ts.isIdentifier(statement.expression.left.expression) &&
    ts.isIdentifier(statement.expression.left.name)
  ) {
    // `Card.Header = …`: memberOf() analyzes the right-hand side under the
    // property name, so the property name is the identity.
    return statement.expression.left.name.text;
  }

  return null;
}
