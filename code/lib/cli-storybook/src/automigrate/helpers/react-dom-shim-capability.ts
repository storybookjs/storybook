import { types as t } from 'storybook/internal/babel';

type CapabilityCallPath = {
  node: t.CallExpression | t.OptionalCallExpression;
  parent: t.Node;
};

export const capabilityCallEscapes = (
  path: CapabilityCallPath,
  isCapability: boolean,
  allowObjectPattern: boolean
) => {
  if (!isCapability) return false;
  const parent = path.parent;
  const target =
    (t.isVariableDeclarator(parent) && parent.init === path.node && parent.id) ||
    (t.isAssignmentExpression(parent) && parent.right === path.node && parent.left);
  return !(t.isIdentifier(target) || (allowObjectPattern && t.isObjectPattern(target)));
};
