/* eslint-disable no-underscore-dangle */
import { types as t, traverse } from '@storybook/core/babel';

import { isValidPreviewPath, loadCsf, printCsf } from '@storybook/core/csf-tools';

import * as babel from '@babel/core';
import type { FileInfo } from 'jscodeshift';
import prettier from 'prettier';

const logger = console;

export default async function transform(info: FileInfo) {
  const csf = loadCsf(info.source, { makeTitle: (title) => title });
  const fileNode = csf._ast;

  try {
    csf.parse();
  } catch (err) {
    logger.log(`Error ${err}, skipping`);
    return info.source;
  }

  const metaVariableName = 'meta';

  /**
   * Add the preview import if it doesn't exist yet:
   *
   * `import { config } from '#.storybook/preview'`;
   */
  const programNode = fileNode.program;
  let foundConfigImport = false;

  programNode.body.forEach((node) => {
    if (t.isImportDeclaration(node) && isValidPreviewPath(node.source.value)) {
      const hasConfigSpecifier = node.specifiers.some(
        (specifier) =>
          t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported, { name: 'config' })
      );

      if (!hasConfigSpecifier) {
        node.specifiers.push(
          babel.types.importSpecifier(
            babel.types.identifier('config'),
            babel.types.identifier('config')
          )
        );
      }

      foundConfigImport = true;
    }
  });

  const hasMeta = !!csf._meta;

  Object.entries(csf._storyExports).forEach(([key, decl]) => {
    const id = decl.id;
    const declarator = decl as babel.types.VariableDeclarator;
    let init = t.isVariableDeclarator(declarator) ? declarator.init : undefined;

    if (t.isIdentifier(id) && init) {
      if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) {
        init = init.expression;
      }

      if (t.isObjectExpression(init)) {
        const typeAnnotation = id.typeAnnotation;
        // Remove type annotation as it's now inferred
        if (typeAnnotation) {
          id.typeAnnotation = null;
        }

        // Wrap the object in `meta.story()`
        declarator.init = babel.types.callExpression(
          babel.types.memberExpression(
            babel.types.identifier(metaVariableName),
            babel.types.identifier('story')
          ),
          [init]
        );
      }
    }
  });

  // modify meta
  if (csf._metaPath) {
    const declaration = csf._metaPath.node.declaration;
    if (t.isObjectExpression(declaration)) {
      const metaVariable = babel.types.variableDeclaration('const', [
        babel.types.variableDeclarator(
          babel.types.identifier(metaVariableName),
          babel.types.callExpression(
            babel.types.memberExpression(
              babel.types.identifier('config'),
              babel.types.identifier('meta')
            ),
            [declaration]
          )
        ),
      ]);
      csf._metaPath.replaceWith(metaVariable);
    } else if (t.isIdentifier(declaration)) {
      /**
       * Transform const declared metas:
       *
       * `const meta = {}; export default meta;`
       *
       * Into a meta call:
       *
       * `const meta = config.meta({ title: 'A' });`
       */
      const binding = csf._metaPath.scope.getBinding(declaration.name);
      if (binding && binding.path.isVariableDeclarator()) {
        const originalName = declaration.name;

        // Always rename the meta variable to 'meta'
        binding.path.node.id = babel.types.identifier(metaVariableName);

        let init = binding.path.node.init;
        if (t.isTSSatisfiesExpression(init) || t.isTSAsExpression(init)) {
          init = init.expression;
        }
        if (t.isObjectExpression(init)) {
          binding.path.node.init = babel.types.callExpression(
            babel.types.memberExpression(
              babel.types.identifier('config'),
              babel.types.identifier('meta')
            ),
            [init]
          );
        }

        // Update all references to the original name
        csf._metaPath.scope.rename(originalName, metaVariableName);
      }

      // Remove the default export, it's not needed anymore
      csf._metaPath.remove();
    }
  }

  if (hasMeta && !foundConfigImport) {
    const configImport = babel.types.importDeclaration(
      [
        babel.types.importSpecifier(
          babel.types.identifier('config'),
          babel.types.identifier('config')
        ),
      ],
      babel.types.stringLiteral('#.storybook/preview')
    );
    programNode.body.unshift(configImport);
  }

  function isSpecifierUsed(name: string) {
    let isUsed = false;

    // Traverse the AST and check for usage of the name
    traverse(programNode, {
      Identifier(path) {
        if (path.node.name === name) {
          isUsed = true;
          // Stop traversal early if we've found a match
          path.stop();
        }
      },
    });

    return isUsed;
  }

  // Remove type imports – now inferred – from @storybook/* packages
  const disallowlist = [
    'Story',
    'StoryFn',
    'StoryObj',
    'Meta',
    'MetaObj',
    'ComponentStory',
    'ComponentMeta',
  ];

  programNode.body = programNode.body.filter((node) => {
    if (t.isImportDeclaration(node)) {
      const { source, specifiers } = node;

      if (source.value.startsWith('@storybook/')) {
        const allowedSpecifiers = specifiers.filter((specifier) => {
          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            return !disallowlist.includes(specifier.imported.name);
          }
          // Retain non-specifier imports (e.g., namespace imports)
          return true;
        });

        // Remove the entire import if no specifiers are left
        if (allowedSpecifiers.length > 0) {
          node.specifiers = allowedSpecifiers;
          return true;
        }

        // Remove the import if no specifiers remain
        return false;
      }
    }

    // Retain all other nodes
    return true;
  });

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
