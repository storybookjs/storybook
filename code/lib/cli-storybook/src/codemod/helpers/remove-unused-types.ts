import { types as t, traverse } from 'storybook/internal/babel';

import { cleanupTypeImports } from './csf-factories-utils';

// Name of types that should be removed from the import list
const typesDisallowList = [
  'Story',
  'StoryFn',
  'StoryObj',
  'Meta',
  'MetaObj',
  'ComponentStory',
  'ComponentMeta',
];

// Helper to detect if a type node references (directly) any type in typesDisallowList
function isReferencingDisallowedType(
  typeNode: t.TSTypeAliasDeclaration | t.TSInterfaceDeclaration
): boolean {
  let found = false;
  traverse(typeNode, {
    noScope: true,
    TSTypeReference(path) {
      if (
        t.isIdentifier(path.node.typeName) &&
        typesDisallowList.includes(path.node.typeName.name)
      ) {
        found = true;
        path.stop();
      }
    },
    TSExpressionWithTypeArguments(path) {
      if (
        t.isIdentifier(path.node.expression) &&
        typesDisallowList.includes(path.node.expression.name)
      ) {
        found = true;
        path.stop();
      }
    },
  });
  return found;
}

/**
 * Remove unused Storybook-specific type aliases from the program
 *
 * Only removes types that:
 *
 * 1. Reference Storybook types (Meta, Story, StoryObj, etc.)
 * 2. Are not actually used anywhere in the code
 */
export function removeUnusedTypes(programNode: t.Program, ast: t.File): void {
  // Find all type and interface declarations in the AST
  const declaredTypes = new Map<string, t.TSTypeAliasDeclaration | t.TSInterfaceDeclaration>();

  traverse(ast, {
    TSTypeAliasDeclaration(path) {
      const name = path.node.id.name;
      declaredTypes.set(name, path.node);
    },
    TSInterfaceDeclaration(path) {
      const name = path.node.id.name;
      declaredTypes.set(name, path.node);
    },
  });

  const declaredTypeNames = new Set(declaredTypes.keys());
  const referencedTypes = new Set<string>();

  traverse(ast, {
    Identifier(path) {
      const { node, parent } = path;

      // Only track as "used" if it's not the id of a declaration and refers to a declared type/interface
      if (
        declaredTypeNames.has(node.name) &&
        !(
          (t.isTSTypeAliasDeclaration(parent) && parent.id === node) ||
          (t.isTSInterfaceDeclaration(parent) && parent.id === node)
        )
      ) {
        referencedTypes.add(node.name);
      }
    },
  });

  // First: Removes (only unused) types that reference Storybook types
  programNode.body = programNode.body.filter((node) => {
    if (
      (t.isTSTypeAliasDeclaration(node) || t.isTSInterfaceDeclaration(node)) &&
      declaredTypes.has(node.id.name) &&
      !referencedTypes.has(node.id.name)
    ) {
      // Remove ONLY IF this type/interface refers to any from typesDisallowList
      if (isReferencingDisallowedType(node)) {
        return false;
      }
    }
    return true;
  });

  // Second: Remove (only unused) type imports – now inferred – from @storybook/* packages
  programNode.body = cleanupTypeImports(programNode, typesDisallowList);
}
