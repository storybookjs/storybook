import {
  type ESTree as E,
  type SourceEditor,
  loadCsf,
  printCsf,
  storyShapeError,
  walk,
} from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';

import type { API, FileInfo } from 'jscodeshift';
import prettier from 'prettier';

const deprecatedTypes = [
  'ComponentStory',
  'ComponentStoryFn',
  'ComponentStoryObj',
  'ComponentMeta',
  'Story',
];

function migrateType(oldType: string) {
  if (oldType === 'Story' || oldType === 'ComponentStory') {
    return 'StoryFn';
  }
  return oldType.replace('Component', '');
}

export default async function transform(info: FileInfo, api: API, options: { parser?: string }) {
  // TODO what do I need to with the title?
  const csf = loadCsf(info.source, { makeTitle: (title) => title });

  upgradeDeprecatedTypes(csf._editor);

  let output = printCsf(csf).code;

  try {
    output = await prettier.format(output, {
      ...(await prettier.resolveConfig(info.path)),
      filepath: info.path,
    });
  } catch (e) {
    logger.log(`Failed applying prettier to ${info.path}.`);
  }

  return output;
}

export const parser = 'tsx';

const importedName = (specifier: E.ImportDeclarationSpecifier) =>
  specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier'
    ? specifier.imported.name
    : undefined;

/** Rename deprecated Storybook type imports and their references, then commit the edits. */
export function upgradeDeprecatedTypes(editor: SourceEditor) {
  const importedNamespaces: Set<string> = new Set();
  const typeReferencesToUpdate: Set<string> = new Set();
  const existingImports: { name: string; isAlias: boolean; node: E.Node }[] = [];

  for (const statement of editor.program.body) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }
    const { specifiers } = statement;
    existingImports.push(
      ...specifiers.map((specifier) => ({
        name: specifier.local.name,
        isAlias: importedName(specifier) !== specifier.local.name,
        node: specifier as E.Node,
      }))
    );

    if (!statement.source.value.startsWith('@storybook')) {
      continue;
    }

    let changed = false;
    const texts = specifiers.flatMap((specifier) => {
      const text = editor.source(specifier);
      if (specifier.type === 'ImportNamespaceSpecifier') {
        importedNamespaces.add(specifier.local.name);
      }
      const imported = importedName(specifier);
      if (
        specifier.type !== 'ImportSpecifier' ||
        !imported ||
        !deprecatedTypes.includes(imported)
      ) {
        return [text];
      }
      const isShorthand = imported === specifier.local.name;
      // we don't have to rewrite type references for aliased imports
      if (isShorthand) {
        typeReferencesToUpdate.add(specifier.local.name);
      }

      const newType = migrateType(imported);
      changed = true;

      // replace the deprecated import type when the new type isn't yet imported
      // note that we don't replace the local name of the specifier
      if (!existingImports.some((it) => it.name === newType)) {
        existingImports.push({ name: newType, isAlias: false, node: specifier });
        return [isShorthand ? newType : `${newType} as ${specifier.local.name}`];
      }
      // if the existing import has the same local name but is an alias we throw
      // we could have imported the type with an alias, but seems to much effort
      const existingImport = existingImports.find((it) => it.name === newType && it.isAlias);
      if (existingImport) {
        throw storyShapeError(
          'This codemod does not support local imports that are called the same as a storybook import.\n' +
            'Rename this local import and try again.',
          existingImport.node,
          editor
        );
      }
      // if the type already exists, without being aliased
      // we can safely remove the deprecated import now
      return [];
    });

    if (changed) {
      editor.edits.overwrite(specifiers[0].start, specifiers.at(-1)!.end, texts.join(', '));
    }
  }

  walk(editor.program, (node) => {
    if (node.type !== 'TSTypeReference') {
      return;
    }
    const { typeName } = node;
    if (typeName.type === 'Identifier') {
      if (typeReferencesToUpdate.has(typeName.name)) {
        editor.edits.overwrite(typeName.start, typeName.end, migrateType(typeName.name));
      }
    } else if (
      // For example SB.StoryObj
      typeName.type === 'TSQualifiedName' &&
      typeName.left.type === 'Identifier' &&
      importedNamespaces.has(typeName.left.name) &&
      deprecatedTypes.includes(typeName.right.name)
    ) {
      editor.edits.overwrite(
        typeName.right.start,
        typeName.right.end,
        migrateType(typeName.right.name)
      );
    }
  });

  editor.commit();
}
