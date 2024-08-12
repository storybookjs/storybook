import { getStoryTitle } from 'storybook/internal/common';
import type { StoriesEntry } from 'storybook/internal/types';

import MagicString from 'magic-string';
import { dedent } from 'ts-dedent';
import typescript from 'typescript';

import type { InternalOptions } from './types';

// Main transform function for the Vitest plugin
export async function transform({
  code,
  id,
  options,
  stories,
}: {
  code: string;
  id: string;
  options: InternalOptions;
  stories: StoriesEntry[];
}) {
  const isStoryFile = /\.stor(y|ies)\./.test(id);
  if (!isStoryFile) {
    return code;
  }
  const sourceFile = typescript.createSourceFile(id, code, typescript.ScriptTarget.ESNext, true);

  const s = new MagicString(code);

  const tagsFilter = JSON.stringify({
    include: options.tags.include,
    exclude: options.tags.exclude,
    skip: options.tags.skip,
  });

  let metaExportName = '__STORYBOOK_META__';

  const modifyMeta = (node: typescript.ExportAssignment) => {
    const exportExpression = node.expression;

    if (typescript.isIdentifier(exportExpression)) {
      // Handle default export as a variable, e.g. "export default meta"
      metaExportName = exportExpression.getText();

      // Find the corresponding variable statement for the export
      const metaDeclaration = sourceFile.statements.find(
        (stmt): stmt is typescript.VariableStatement =>
          typescript.isVariableStatement(stmt) &&
          stmt.declarationList.declarations.some(
            (decl) => typescript.isIdentifier(decl.name) && decl.name.getText() === metaExportName
          )
      );

      if (metaDeclaration) {
        const metaObjectLiteral = metaDeclaration.declarationList.declarations[0]
          .initializer as typescript.Node;
        if (
          typescript.isObjectLiteralExpression(metaObjectLiteral) &&
          !metaObjectLiteral.properties.some(
            (prop) =>
              typescript.isPropertyAssignment(prop) &&
              typescript.isIdentifier(prop.name) &&
              prop.name.getText() === 'title'
          )
        ) {
          const title = getStoryTitle({ storyFilePath: id, configDir: options.configDir, stories });

          const insertPos = metaObjectLiteral.getStart() + 1;
          s.appendLeft(insertPos, `\n\ttitle: '${title}',\n`);
        }
      }
    } else if (typescript.isObjectLiteralExpression(exportExpression)) {
      // Handle inline default export, e.g. "export default {}"
      const hasTitleProperty = exportExpression.properties.some(
        (prop) =>
          typescript.isPropertyAssignment(prop) &&
          typescript.isIdentifier(prop.name) &&
          prop.name.getText() === 'title'
      );

      if (!hasTitleProperty) {
        const title = getStoryTitle({ storyFilePath: id, configDir: options.configDir, stories });

        const insertPos = exportExpression.getStart() + 1;
        s.appendLeft(insertPos, `\n\ttitle: '${title}',\n`);
      }

      // Replace inline export with a variable
      const defaultExportCode = s.slice(exportExpression.getStart(), exportExpression.getEnd());
      const nodeInsertPos = node.getStart();
      s.overwrite(
        nodeInsertPos,
        node.getEnd(),
        `const ${metaExportName} = ${defaultExportCode};\nexport default ${metaExportName};`
      );
    }
  };

  const defaultExportNode = sourceFile.statements.find((node) =>
    typescript.isExportAssignment(node)
  ) as typescript.ExportAssignment;

  if (!defaultExportNode) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(
      'The Storybook vitest plugin could not detect the meta (default export) object in the story file. \n\nPlease make sure you have a default export with the meta object. If you are using a different export format that is not supported, please file an issue with details about your use case.'
    );
  }

  modifyMeta(defaultExportNode);

  const declarationMap = new Map<string, typescript.Node>();

  // declarations are collected in order to prepend the test statement to stories which do
  // const MyStory = {}; export { MyStory };
  const collectDeclarations = (node: typescript.Node) => {
    if (typescript.isVariableDeclaration(node) && typescript.isIdentifier(node.name)) {
      declarationMap.set(node.name.text, node);
    }

    typescript.forEachChild(node, collectDeclarations);
  };

  collectDeclarations(sourceFile);

  const addTestStatementToStory = (
    element: typescript.ExportSpecifier | typescript.VariableDeclaration
  ) => {
    const exportName = element.name.getText();
    const firstChar = element.parent.parent.getStart();
    const lastChar = code.indexOf('\n', firstChar);

    /**
     * declarationLine: export const Primary: Story = {\n
     *                  ^                              ^
     *              firstChar                       lastChar
     */
    const declarationLine = code.substring(firstChar, lastChar);

    const testStatement = dedent`
      __test('${exportName}', __testStory('${exportName}', import.meta.url, __composeStories, ${tagsFilter}));
    `;

    // Rewrite story declaration while keeping original source map location
    const newDeclarationLine = `${testStatement}\n${declarationLine}`;
    s.overwrite(firstChar, lastChar, newDeclarationLine);
  };

  // Traverse the AST and find all named exports
  const modifyStories = (node: typescript.Node) => {
    if (
      // defined stories like "export { Primary }"
      typescript.isExportDeclaration(node) &&
      node.exportClause &&
      typescript.isNamedExports(node.exportClause)
    ) {
      for (const element of node.exportClause.elements) {
        const declaration = declarationMap.get(element.name.text);
        if (declaration) {
          addTestStatementToStory(declaration as typescript.VariableDeclaration);
        }
      }
    } else if (
      // defined stories like "export const Primary = {}"
      typescript.isVariableStatement(node) &&
      node.modifiers?.some((mod) => mod.kind === typescript.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of node.declarationList.declarations) {
        if (typescript.isIdentifier(declaration.name)) {
          addTestStatementToStory(declaration);
        }
      }
    }

    typescript.forEachChild(node, modifyStories);
  };

  typescript.forEachChild(sourceFile, modifyStories);

  // Add necessary imports to the transformed file
  s.append(
    dedent`\n
      import { test as __test } from 'vitest';
      import { composeStories as __composeStories } from 'storybook/internal/preview-api';
      import { testStory as __testStory } from '@storybook/experimental-addon-vitest/internal/test-utils';
    `
  );

  return {
    code: s.toString(),
    map: s.generateMap({
      hires: true,
      source: id,
    }),
  };
}
