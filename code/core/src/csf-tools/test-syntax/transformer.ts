/* eslint-disable local-rules/no-uncategorized-errors */
import { types as t } from 'storybook/internal/babel';
import { getStoryTitle } from 'storybook/internal/common';
import type { StoriesEntry } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { formatCsf, loadCsf } from '../CsfFile';

const logger = console;

export async function testTransform({
  code,
  fileName,
  configDir,
  stories,
}: {
  code: string;
  fileName: string;
  configDir: string;
  stories: StoriesEntry[];
}): Promise<ReturnType<typeof formatCsf>> {
  const isStoryFile = /\.stor(y|ies)\./.test(fileName);
  if (!isStoryFile) {
    return code;
  }

  const parsed = loadCsf(code, {
    fileName,
    transformInlineMeta: true,
    makeTitle: (title) => {
      const result =
        getStoryTitle({
          storyFilePath: fileName,
          configDir,
          stories,
          userTitle: title,
        }) || 'unknown';

      if (result === 'unknown') {
        logger.warn(
          dedent`
            [Storybook]: Could not calculate story title for "${fileName}".
            Please make sure that this file matches the globs included in the "stories" field in your Storybook configuration at "${configDir}".
          `
        );
      }
      return result;
    },
  }).parse();

  const ast = parsed._ast;

  const metaNode = parsed._metaNode as t.ObjectExpression;

  const metaTitleProperty = metaNode.properties.find(
    (prop) => t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'title'
  );

  const metaTitle = t.stringLiteral(parsed._meta?.title || 'unknown');
  if (!metaTitleProperty) {
    metaNode.properties.push(t.objectProperty(t.identifier('title'), metaTitle));
  } else if (t.isObjectProperty(metaTitleProperty)) {
    // If the title is present in meta, overwrite it because autotitle can still affect existing titles
    metaTitleProperty.value = metaTitle;
  }

  if (!metaNode || !parsed._meta) {
    throw new Error(
      'Storybook could not detect the meta (default export) object in the story file. \n\nPlease make sure you have a default export with the meta object. If you are using a different export format that is not supported, please file an issue with details about your use case.'
    );
  }

  // Generate new story exports from tests attached to stories
  const newExports: t.ExportNamedDeclaration[] = [];
  let testCounter = 1;

  // Track nodes to remove from the AST
  const nodesToRemove: t.Node[] = [];

  // Process each story to find attached tests
  Object.entries(parsed._stories).forEach(([storyExportName, storyInfo]) => {
    // Find all test calls on this story in the AST
    ast.program.body.forEach((node) => {
      if (!t.isExpressionStatement(node)) {
        return;
      }

      const { expression } = node;

      if (!t.isCallExpression(expression)) {
        return;
      }

      const { callee, arguments: args } = expression;

      // Check if it's a call like StoryName.test()
      if (
        t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        callee.object.name === storyExportName &&
        t.isIdentifier(callee.property) &&
        callee.property.name === 'test' &&
        args.length >= 2 &&
        t.isStringLiteral(args[0]) &&
        (t.isFunctionExpression(args[1]) || t.isArrowFunctionExpression(args[1]))
      ) {
        // Get test name and body
        const testName = (args[0] as t.StringLiteral).value;
        const testFunction = args[1] as t.FunctionExpression | t.ArrowFunctionExpression;

        // Create unique export name for the test story
        const testExportName = `_test${testCounter > 1 ? testCounter : ''}`;
        testCounter++;

        // Create a new story object with the test function integrated as play function
        const newStoryObject = t.objectExpression([
          t.spreadElement(t.identifier(storyExportName)),
          // Add tags property that preserves existing tags and adds 'test-fn'
          t.objectProperty(
            t.identifier('tags'),
            t.arrayExpression([
              // Spread existing tags if they exist
              t.spreadElement(
                t.optionalMemberExpression(
                  t.identifier(storyExportName),
                  t.identifier('tags'),
                  false,
                  true
                )
              ),
              // Add the test-fn tag
              t.stringLiteral('test-fn'),
            ])
          ),
          t.objectProperty(
            t.identifier('play'),
            t.arrowFunctionExpression(
              [t.identifier('context')],
              t.blockStatement([
                // Add code to call the original story's play function if it exists
                t.expressionStatement(
                  t.awaitExpression(
                    t.callExpression(
                      t.optionalMemberExpression(
                        t.identifier(storyExportName),
                        t.identifier('play'),
                        false,
                        true
                      ),
                      []
                    )
                  )
                ),
                // Then add the test function body
                ...(t.isBlockStatement(testFunction.body)
                  ? testFunction.body.body
                  : [t.expressionStatement(testFunction.body)]),
              ]),
              true // async
            )
          ),
          t.objectProperty(
            t.identifier('storyName'),
            t.stringLiteral(`${storyInfo.name || storyExportName}: ${testName}`)
          ),
        ]);

        // Create export statement
        const exportDeclaration = t.exportNamedDeclaration(
          t.variableDeclaration('const', [
            t.variableDeclarator(t.identifier(testExportName), newStoryObject),
          ]),
          []
        );

        newExports.push(exportDeclaration);

        // Mark the original test call for removal
        nodesToRemove.push(node);
      }
    });
  });

  // Remove the test calls from the AST
  ast.program.body = ast.program.body.filter((node) => !nodesToRemove.includes(node));

  // Add new exports to the AST
  ast.program.body.push(...newExports);

  return formatCsf(parsed, { sourceMaps: true, sourceFileName: fileName }, code);
}
