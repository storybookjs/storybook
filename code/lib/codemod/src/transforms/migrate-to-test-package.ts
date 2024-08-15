/* eslint-disable no-underscore-dangle */
import { loadCsf, printCsf } from '@storybook/core/csf-tools';

import type { BabelFile } from '@babel/core';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import type { FileInfo } from 'jscodeshift';
import prettier from 'prettier';

export default async function transform(info: FileInfo) {
  const csf = loadCsf(info.source, { makeTitle: (title) => title });
  const fileNode = csf._ast;
  // @ts-expect-error File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606
  const file: BabelFile = new babel.File(
    { filename: info.path },
    { code: info.source, ast: fileNode }
  );

  file.path.traverse({
    ImportDeclaration: (path) => {
      if (
        path.node.source.value === '@storybook/jest' ||
        path.node.source.value === '@storybook/testing-library'
      ) {
        if (path.node.source.value === '@storybook/jest') {
          path.get('specifiers').forEach((specifier) => {
            if (specifier.isImportSpecifier()) {
              const imported = specifier.get('imported');

              if (!imported.isIdentifier()) {
                return;
              }
              if (imported.node.name === 'jest') {
                specifier.remove();
                path.insertAfter(
                  t.importDeclaration(
                    [t.importNamespaceSpecifier(t.identifier('test'))],
                    t.stringLiteral('@storybook/test')
                  )
                );
              }
            }
          });
        }
        path.get('source').replaceWith(t.stringLiteral('@storybook/test'));
      }
    },
    Identifier: (path) => {
      if (path.node.name === 'jest') {
        path.replaceWith(t.identifier('test'));
      }
    },
  });

  let output = printCsf(csf).code;
  try {
    output = await prettier.format(output, {
      ...(await prettier.resolveConfig(info.path)),
      filepath: info.path,
    });
  } catch (e) {
    console.warn(`Failed applying prettier to ${info.path}.`);
  }
  return output;
}

export const parser = 'tsx';
