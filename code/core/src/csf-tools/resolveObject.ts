import { type NodePath, types as t } from 'storybook/internal/babel';

import { pathForNode, unwrapExpression } from './story-shape/index.ts';

export const resolveExpression = (node: t.Node, scope: NodePath['scope']): t.Node | undefined => {
  const program = scope.getProgramParent().path;
  if (!program.isProgram()) {
    return undefined;
  }
  let value = unwrapExpression(node);
  const visited = new Set<t.Node>();
  while (t.isIdentifier(value) && !visited.has(value)) {
    visited.add(value);
    const reference = pathForNode(program, value);
    const binding = reference?.scope.getBinding(value.name);
    if (!binding && reference && value.name === 'undefined') {
      return value;
    }
    if (
      !binding?.constant ||
      binding.referencePaths.length !== 1 ||
      binding.referencePaths[0].node !== value ||
      !binding.path.isVariableDeclarator() ||
      !binding.path.node.init
    ) {
      return undefined;
    }
    value = unwrapExpression(binding.path.node.init);
  }
  return value;
};

export const resolveObject = (
  node: t.Node,
  scope: NodePath['scope']
): t.ObjectExpression | undefined => {
  let value = resolveExpression(node, scope);
  const visited = new Set<t.Node>();
  while (t.isObjectExpression(value) && !visited.has(value)) {
    visited.add(value);
    const [member] = value.properties;
    if (value.properties.length !== 1 || !t.isSpreadElement(member)) {
      return value;
    }
    const spread = resolveExpression(member.argument, scope);
    if (!t.isObjectExpression(spread)) {
      return value;
    }
    value = spread;
  }
  return undefined;
};
