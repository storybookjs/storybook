import { traverse, types as t } from 'storybook/internal/babel';

/**
 * Names a node reaches for from outside itself. ES globals count as resolved, since they mean the
 * same wherever the snippet lands.
 */
export const freeNames = (node: t.Node): Set<string> => {
  const statement = t.isStatement(node)
    ? node
    : t.isExpression(node)
      ? t.expressionStatement(node)
      : t.isObjectMethod(node)
        ? t.expressionStatement(t.objectExpression([node]))
        : undefined;

  if (statement === undefined) {
    throw new Error(
      `Cannot read the names a ${node.type} depends on: it is not a statement or an expression`
    );
  }

  // The clone keeps this traversal from binding scope information to nodes the story file's own
  // program still owns.
  const wrapped = t.file(t.program([t.cloneNode(statement, true) as t.Statement]));
  const names = new Set<string>();
  traverse(wrapped, {
    ReferencedIdentifier(path) {
      if (!path.scope.hasBinding(path.node.name)) {
        names.add(path.node.name);
      }
    },
  });
  return names;
};
