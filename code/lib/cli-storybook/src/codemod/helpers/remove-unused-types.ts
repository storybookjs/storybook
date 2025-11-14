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

const disallowedTypesSet = new Set(typesDisallowList);

/**
 * Remove unused Storybook-specific type aliases from the program.
 *
 * Conditions to remove a declared type/interface:
 *
 * - It is declared in the file,
 * - It is not referenced anywhere in the file,
 * - AND it (the declaration) references at least one Storybook type from typesDisallowList.
 *
 * This implementation performs a single traversal of `ast`. During traversal we:
 *
 * - Collect declared type names,
 * - Record references to declared types (including handling references that appear before
 *   declarations),
 * - Detect per-declaration whether it references any disallowed Storybook type, and then perform a
 *   single filter pass on program.body.
 */
export function removeUnusedTypes(programNode: t.Program, ast: t.File): void {
  // Declared type/interface names seen in this file
  const declaredTypes = new Set<string>();

  // Names of declared types that are referenced somewhere in the file
  const referencedTypes = new Set<string>();

  // Temporary: identifier names seen before we encountered their declaration
  // This lets us count forward references (identifier appears before type is declared).
  const pendingIdentifierNames = new Set<string>();

  // Names of type declarations that (somewhere in their AST) reference a disallowed Storybook type
  const typeDeclReferencesDisallowed = new Set<string>();

  traverse(ast, {
    enter(path) {
      const node = path.node;

      // 1) When we encounter a type/interface declaration, register it.
      if (path.isTSTypeAliasDeclaration() || path.isTSInterfaceDeclaration()) {
        // These always have an `id` property that's an Identifier
        const idNode = (node as t.TSTypeAliasDeclaration | t.TSInterfaceDeclaration).id;
        const name = idNode && t.isIdentifier(idNode) ? idNode.name : undefined;
        if (name) {
          declaredTypes.add(name);

          // If we previously saw identifiers with this name before the declaration,
          // count them now as references (handles reference-before-declaration).
          if (pendingIdentifierNames.has(name)) {
            referencedTypes.add(name);
          }
        }

        // No need to traverse into the id itself here; we still want to traverse the
        // declaration body so that disallowed-type references inside are detected
        // by the TSTypeReference/TSExpressionWithTypeArguments handlers below.
        return;
      }

      // 2) Track identifier references to declared types.
      if (path.isIdentifier()) {
        const identifierNode = node as t.Identifier;
        const name = identifierNode.name;

        // Skip the identifier that *is* the declaration id itself:
        // parent is TSTypeAliasDeclaration or TSInterfaceDeclaration and its id is this node
        const parentPath = path.parentPath;
        if (
          parentPath &&
          (parentPath.isTSTypeAliasDeclaration() || parentPath.isTSInterfaceDeclaration())
        ) {
          const parentIdNode = (
            parentPath.node as t.TSTypeAliasDeclaration | t.TSInterfaceDeclaration
          ).id;
          if (parentIdNode === node) {
            return;
          }
        }

        // If we've already seen the declaration, mark as referenced.
        if (declaredTypes.has(name)) {
          referencedTypes.add(name);
        } else {
          // Otherwise record as pending — if the declaration appears later, we'll promote it.
          pendingIdentifierNames.add(name);
        }

        return;
      }

      // 3) Detect references to disallowed Storybook types inside type declarations.
      // If we find one, record which type declaration (owner) contains it.
      if (path.isTSTypeReference()) {
        const typeRefNode = node as t.TSTypeReference;
        const typeNameNode = typeRefNode.typeName;

        if (t.isIdentifier(typeNameNode) && disallowedTypesSet.has(typeNameNode.name)) {
          // Find the nearest enclosing type declaration (alias or interface)
          const owner = path.findParent(
            (p) => p.isTSTypeAliasDeclaration() || p.isTSInterfaceDeclaration()
          );
          if (owner && (owner.isTSTypeAliasDeclaration() || owner.isTSInterfaceDeclaration())) {
            const ownerId = (owner.node as t.TSTypeAliasDeclaration | t.TSInterfaceDeclaration).id;
            const ownerName = t.isIdentifier(ownerId) ? ownerId.name : undefined;
            if (ownerName) {
              typeDeclReferencesDisallowed.add(ownerName);
            }
          }
        }

        return;
      }

      if (path.isTSExpressionWithTypeArguments()) {
        const tsExprNode = node as t.TSExpressionWithTypeArguments;
        const expr = tsExprNode.expression;
        if (t.isIdentifier(expr) && disallowedTypesSet.has(expr.name)) {
          const owner = path.findParent(
            (p) => p.isTSTypeAliasDeclaration() || p.isTSInterfaceDeclaration()
          );
          if (owner && (owner.isTSTypeAliasDeclaration() || owner.isTSInterfaceDeclaration())) {
            const ownerId = (owner.node as t.TSTypeAliasDeclaration | t.TSInterfaceDeclaration).id;
            const ownerName = t.isIdentifier(ownerId) ? ownerId.name : undefined;
            if (ownerName) {
              typeDeclReferencesDisallowed.add(ownerName);
            }
          }
        }
        return;
      }
    },
  });

  // Final pass: remove unused declared types that reference disallowed types
  programNode.body = programNode.body.filter((node) => {
    if (t.isTSTypeAliasDeclaration(node) || t.isTSInterfaceDeclaration(node)) {
      const name = node.id.name;

      // If it's a declared type, unused, and references a disallowed Storybook type — remove it.
      if (
        declaredTypes.has(name) &&
        !referencedTypes.has(name) &&
        typeDeclReferencesDisallowed.has(name)
      ) {
        return false; // filter out (remove)
      }
    }

    return true; // keep everything else
  });

  // Cleanup any now-unused Storybook type imports (keeps original API: pass array)
  programNode.body = cleanupTypeImports(programNode, typesDisallowList);
}
