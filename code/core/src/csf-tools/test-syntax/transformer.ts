import { types as t } from 'storybook/internal/babel';

import { formatCsf, loadCsf } from '../CsfFile';

function toPascalCase(text: string): string {
  return text
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export async function testTransform({
  code,
  fileName,
}: {
  code: string;
  fileName: string;
}): Promise<ReturnType<typeof formatCsf>> {
  const isStoryFile = /\.stor(y|ies)\./.test(fileName);
  if (!isStoryFile) {
    return code;
  }

  const parsed = loadCsf(code, {
    fileName,
    transformInlineMeta: true,
    makeTitle: (title) => title || 'unknown',
  }).parse();

  if (!parsed._metaIsFactory) {
    return code;
  }

  const ast = parsed._ast;

  const metaExportName = parsed._metaVariableName ?? 'meta';
  const storyExports = Object.keys(parsed._stories);
  const newDeclarations: {
    node: t.ExpressionStatement;
    declaration: t.ExportNamedDeclaration;
  }[] = [];

  // Generate new story exports from tests attached to stories
  ast.program.body.forEach((node) => {
    if (!t.isExpressionStatement(node)) {
      return;
    }

    const { expression } = node;

    if (!t.isCallExpression(expression)) {
      return;
    }

    const { callee, arguments: args } = expression;

    const isStoryTest =
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object) &&
      storyExports.includes(callee.object.name) &&
      t.isIdentifier(callee.property) &&
      callee.property.name === 'test';

    if (isStoryTest) {
      const storyExportName = (callee.object as t.Identifier).name;
      // Get test name and body
      const testName = (args[0] as t.StringLiteral).value;
      const testFunction = args[1] as t.FunctionExpression | t.ArrowFunctionExpression;

      // Create export name from story name + test name
      // e.g. Primary.test('exists in the dom', ...) -> "PrimaryExistsInTheDom"
      const testExportName = toPascalCase(`${storyExportName} ${testName}`);

      // Create a new story object with the test function integrated as play function
      const newStoryObject = t.objectExpression([
        t.spreadElement(
          t.memberExpression(t.identifier(storyExportName), t.identifier('composed'))
        ),
        // Add 'test-fn' tag
        t.objectProperty(
          t.identifier('tags'),
          t.arrayExpression([
            // TODO: Tags can't be spread as they have to be statically analyzable
            // This is not a problem because tags are added by the indexer, but
            // for portable stories (ran via the CLI) it will likely be a problem
            // t.spreadElement(
            //   t.memberExpression(
            //     t.memberExpression(t.identifier(storyExportName), t.identifier('composed')),
            //     t.identifier('tags')
            //   )
            // ),
            // Add the test-fn tag
            t.stringLiteral('test-fn'),
          ])
        ),
        t.objectProperty(
          t.identifier('play'),
          t.arrowFunctionExpression(
            [t.identifier('context')],
            t.blockStatement([
              // Reuse original story's play function
              t.expressionStatement(
                t.awaitExpression(
                  t.callExpression(
                    t.memberExpression(t.identifier(storyExportName), t.identifier('play')),
                    [t.identifier('context')]
                  )
                )
              ),
              // handle cases where the context is destructured in the play function
              ...(testFunction.params.length > 0 && t.isObjectPattern(testFunction.params[0])
                ? [
                    t.variableDeclaration('const', [
                      t.variableDeclarator(
                        testFunction.params[0] as t.ObjectPattern,
                        t.identifier('context')
                      ),
                    ]),
                  ]
                : []),
              // add the body of the test function
              ...(t.isBlockStatement(testFunction.body)
                ? testFunction.body.body
                : [t.expressionStatement(testFunction.body)]),
            ]),
            true // async
          )
        ),
        t.objectProperty(t.identifier('name'), t.stringLiteral(testName)),
      ]);

      // Create export statement
      const exportDeclaration = t.exportNamedDeclaration(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(testExportName),
            t.callExpression(
              t.memberExpression(t.identifier(metaExportName), t.identifier('story')),
              [newStoryObject]
            )
          ),
        ]),
        []
      );

      // Preserve source map location from original test call
      exportDeclaration.loc = node.loc;

      newDeclarations.push({ node, declaration: exportDeclaration });
    }
  });

  // Add the new declarations after their corresponding test calls, in reverse order to avoid index issues
  newDeclarations.reverse().forEach(({ node, declaration }) => {
    const index = ast.program.body.indexOf(node);
    if (index !== -1) {
      ast.program.body.splice(index + 1, 0, declaration);
    }
  });

  return formatCsf(parsed, { sourceMaps: true, sourceFileName: fileName }, code);
}
