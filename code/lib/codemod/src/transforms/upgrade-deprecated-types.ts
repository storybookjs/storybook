/* eslint-disable no-underscore-dangle */
import { loadCsf, printCsf } from '@storybook/core/csf-tools';

import type { BabelFile, NodePath } from '@babel/core';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import type { API, FileInfo } from 'jscodeshift';
import prettier from 'prettier';

const logger = console;

const deprecatedTypes = [
  'ComponentStory',
  'ComponentStoryFn',
  'ComponentStoryObj',
  'ComponentMeta',
  'Story',
];

function migrateType(oldType: string) {
  if (oldType === 'Story' || oldType === 'ComponentStory') return 'StoryFn';
  return oldType.replace('Component', '');
}

export default async function transform(info: FileInfo, api: API, options: { parser?: string }) {
  // TODO what do I need to with the title?
  const csf = loadCsf(info.source, { makeTitle: (title) => title });
  const fileNode = csf._ast;
  // @ts-expect-error File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606
  const file: BabelFile = new babel.File(
    { filename: info.path },
    { code: info.source, ast: fileNode }
  );

  upgradeDeprecatedTypes(file);

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

export function upgradeDeprecatedTypes(file: BabelFile) {
  const importedNamespaces: Set<string> = new Set();
  const typeReferencesToUpdate: Set<string> = new Set();
  const existingImports: { name: string; isAlias: boolean; path: NodePath }[] = [];

  file.path.traverse({
    ImportDeclaration: (path) => {
      existingImports.push(
        ...path.get('specifiers').map((specifier) => ({
          name: specifier.node.local.name,
          isAlias: !(
            specifier.isImportSpecifier() &&
            t.isIdentifier(specifier.node.imported) &&
            specifier.node.local.name === specifier.node.imported.name
          ),
          path: specifier,
        }))
      );

      const source = path.node.source.value;
      if (!source.startsWith('@storybook')) return;

      path.get('specifiers').forEach((specifier) => {
        if (specifier.isImportNamespaceSpecifier()) {
          importedNamespaces.add(specifier.node.local.name);
        }
        if (!specifier.isImportSpecifier()) return;
        const imported = specifier.get('imported');
        if (!imported.isIdentifier()) return;

        // if we find a deprecated import
        if (deprecatedTypes.includes(imported.node.name)) {
          // we don't have to rewrite type references for aliased imports
          if (imported.node.name === specifier.node.local.name) {
            typeReferencesToUpdate.add(specifier.node.local.name);
          }

          const newType = migrateType(imported.node.name);

          // replace the deprecated import type when the new type isn't yet imported
          // note that we don't replace the local name of the specifier
          if (!existingImports.some((it) => it.name === newType)) {
            imported.replaceWith(t.identifier(newType));
            existingImports.push({ name: newType, isAlias: false, path: specifier });
          } else {
            // if the existing import has the same local name but is an alias we throw
            // we could have imported the type with an alias, but seems to much effort
            const existingImport = existingImports.find((it) => it.name === newType && it.isAlias);
            if (existingImport) {
              throw existingImport.path.buildCodeFrameError(
                'This codemod does not support local imports that are called the same as a storybook import.\n' +
                  'Rename this local import and try again.'
              );
            } else {
              // if the type already exists, without being aliased
              // we can safely remove the deprecated import now
              specifier.remove();
            }
          }
        }
      });
    },
  });

  file.path.traverse({
    TSTypeReference: (path) => {
      const typeName = path.get('typeName');
      if (typeName.isIdentifier()) {
        if (typeReferencesToUpdate.has(typeName.node.name)) {
          typeName.replaceWith(t.identifier(migrateType(typeName.node.name)));
        }
      } else if (typeName.isTSQualifiedName()) {
        // For example SB.StoryObj
        const namespace = typeName.get('left');
        if (namespace.isIdentifier()) {
          if (importedNamespaces.has(namespace.node.name)) {
            const right = typeName.get('right');
            if (deprecatedTypes.includes(right.node.name)) {
              right.replaceWith(t.identifier(migrateType(right.node.name)));
            }
          }
        }
      }
    },
  });
}
