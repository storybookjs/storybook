import { types as t } from 'storybook/internal/babel';

import { staticString } from './react-dom-shim.ts';

export const memberPropertyName = (node: t.MemberExpression | t.OptionalMemberExpression) =>
  node.computed
    ? staticString(node.property)
    : t.isIdentifier(node.property)
      ? node.property.name
      : undefined;

type LoaderReferencePath = {
  node: t.Identifier | t.JSXIdentifier;
  parent: t.Node;
  parentPath: { parent: t.Node } | null;
};

type LoaderReferenceKind = 'factory' | 'loader' | 'module';

const loaderReferenceKind = (
  name: string,
  loaders: Set<string>,
  factories: Set<string>,
  modules: Set<string>
): LoaderReferenceKind | undefined => {
  if (loaders.has(name)) return 'loader';
  if (factories.has(name)) return 'factory';
  if (modules.has(name) || name === 'module') return 'module';
  return undefined;
};

const propagatesLoaderReference = (parent: t.Node, node: t.Identifier) => {
  if (
    (t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) &&
    parent.callee === node
  ) {
    return true;
  }
  if (t.isVariableDeclarator(parent) && parent.init === node) {
    return t.isIdentifier(parent.id) || t.isObjectPattern(parent.id);
  }
  if (t.isAssignmentExpression(parent) && parent.right === node) {
    return t.isIdentifier(parent.left) || t.isObjectPattern(parent.left);
  }
  return false;
};

const loaderMemberEscapes = (
  node: t.Identifier,
  member: t.MemberExpression | t.OptionalMemberExpression,
  grandparent: t.Node | undefined,
  kind: LoaderReferenceKind
) => {
  const property = memberPropertyName(member);
  if (node.name === 'module' && property === undefined) return true;
  if (node.name === 'module' && property !== 'require') return false;
  const supported =
    (kind === 'loader' && ['require', 'resolve'].includes(property ?? '')) ||
    (kind === 'module' && ['createRequire', 'require'].includes(property ?? ''));
  const called =
    (t.isCallExpression(grandparent) || t.isOptionalCallExpression(grandparent)) &&
    grandparent.callee === member;
  return !supported || !called;
};

export const loaderReferenceEscapes = (
  path: LoaderReferencePath,
  loaders: Set<string>,
  factories: Set<string>,
  modules: Set<string>
) => {
  if (!t.isIdentifier(path.node)) return false;
  const kind = loaderReferenceKind(path.node.name, loaders, factories, modules);
  if (!kind) return false;
  const parent = path.parent;
  if (propagatesLoaderReference(parent, path.node)) return false;
  if (
    (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
    parent.object === path.node
  ) {
    return loaderMemberEscapes(path.node, parent, path.parentPath?.parent, kind);
  }
  return true;
};
