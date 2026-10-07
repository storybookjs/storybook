import {
  type ESTree as E,
  type ESTreeNode as Node,
  type SourceEditor,
  walk,
} from 'storybook/internal/csf-tools';

import { removeStatements } from '../../automigrate/helpers/source-edits.ts';
import { cleanupTypeImports } from './csf-factories-utils.ts';

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

type TypeDeclaration = E.TSTypeAliasDeclaration | E.TSInterfaceDeclaration;

const isTypeDeclaration = (node: Node | null | undefined): node is TypeDeclaration =>
  node?.type === 'TSTypeAliasDeclaration' || node?.type === 'TSInterfaceDeclaration';

/**
 * Remove unused Storybook-specific type aliases from the program, then the Storybook type imports
 * nothing uses anymore. Commits the editor after each removal pass.
 *
 * Conditions to remove a declared type/interface:
 *
 * - It is declared in the file,
 * - It is not referenced anywhere in the file,
 * - AND it (the declaration) references at least one Storybook type from typesDisallowList.
 *
 * A removed type can have held the only reference to another one, such as `type Story =
 * StoryObj<StoryMeta>` to `StoryMeta`, so passes repeat while they remove a type.
 */
export function removeUnusedTypes(editor: SourceEditor): void {
  for (;;) {
    const declaredTypes = new Set<string>();
    const referencedTypes = new Set<string>();
    // Identifier names seen before their declaration, so forward references count.
    const pendingIdentifierNames = new Set<string>();
    const typeDeclReferencesDisallowed = new Set<string>();

    const markOwner = (node: Node) => {
      let owner = editor.parentOf(node);
      while (owner && !isTypeDeclaration(owner)) {
        owner = editor.parentOf(owner);
      }
      if (owner) {
        typeDeclReferencesDisallowed.add(owner.id.name);
      }
    };

    walk(editor.program, (node, parent) => {
      if (isTypeDeclaration(node)) {
        declaredTypes.add(node.id.name);
        if (pendingIdentifierNames.has(node.id.name)) {
          referencedTypes.add(node.id.name);
        }
      } else if (node.type === 'Identifier') {
        if (isTypeDeclaration(parent) && parent.id === node) {
          return;
        }
        if (declaredTypes.has(node.name)) {
          referencedTypes.add(node.name);
        } else {
          pendingIdentifierNames.add(node.name);
        }
      } else if (
        node.type === 'TSTypeReference' &&
        node.typeName.type === 'Identifier' &&
        disallowedTypesSet.has(node.typeName.name)
      ) {
        markOwner(node);
      } else if (
        (node.type === 'TSInterfaceHeritage' || node.type === 'TSClassImplements') &&
        node.expression.type === 'Identifier' &&
        disallowedTypesSet.has(node.expression.name)
      ) {
        markOwner(node);
      }
    });

    const removed = new Set<Node>(
      editor.program.body.filter(
        (node) =>
          isTypeDeclaration(node) &&
          declaredTypes.has(node.id.name) &&
          !referencedTypes.has(node.id.name) &&
          typeDeclReferencesDisallowed.has(node.id.name)
      )
    );
    if (removed.size === 0) {
      break;
    }
    removeStatements(editor, removed);
    editor.commit();
  }

  cleanupTypeImports(editor, typesDisallowList);
}
