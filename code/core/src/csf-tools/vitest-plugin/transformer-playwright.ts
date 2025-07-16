/* eslint-disable local-rules/no-uncategorized-errors */
import { types as t } from 'storybook/internal/babel';
import { getStoryTitle } from 'storybook/internal/common';
import { combineTags, storyNameFromExport, toId } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';
import type { StoriesEntry, Tag } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { formatCsf, loadCsf } from '../CsfFile';

type TagsFilter = {
  include: string[];
  exclude: string[];
  skip: string[];
};

const isValidTest = (storyTags: string[], tagsFilter: TagsFilter) => {
  if (tagsFilter.include.length && !tagsFilter.include.some((tag) => storyTags?.includes(tag))) {
    return false;
  }
  if (tagsFilter.exclude.some((tag) => storyTags?.includes(tag))) {
    return false;
  }
  // Skipped tests are intentionally included here
  return true;
};

export async function vitestPlaywrightTransform({
  code,
  fileName,
  configDir,
  stories,
  tagsFilter,
  previewLevelTags = [],
}: {
  code: string;
  fileName: string;
  configDir: string;
  tagsFilter: TagsFilter;
  stories: StoriesEntry[];
  previewLevelTags: Tag[];
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
      'The Storybook vitest plugin could not detect the meta (default export) object in the story file. \n\nPlease make sure you have a default export with the meta object. If you are using a different export format that is not supported, please file an issue with details about your use case.'
    );
  }

  // Filter out stories based on the passed tags filter
  const validStories: (typeof parsed)['_storyStatements'] = {};
  Object.keys(parsed._stories).map((key) => {
    const finalTags = combineTags(
      'test',
      'dev',
      ...previewLevelTags,
      ...(parsed.meta?.tags || []),
      ...(parsed._stories[key].tags || [])
    );

    if (isValidTest(finalTags, tagsFilter)) {
      validStories[key] = parsed._storyStatements[key];
    }
  });

  const vitestTestId = parsed._file.path.scope.generateUidIdentifier('test');
  const vitestBeforeAllId = parsed._file.path.scope.generateUidIdentifier('beforeAll');
  const vitestAfterAllId = parsed._file.path.scope.generateUidIdentifier('afterAll');
  const vitestDescribeId = parsed._file.path.scope.generateUidIdentifier('describe');

  // if no valid stories are found, we just add describe.skip() to the file to avoid empty test files
  if (Object.keys(validStories).length === 0) {
    const describeSkipBlock = t.expressionStatement(
      t.callExpression(t.memberExpression(vitestDescribeId, t.identifier('skip')), [
        t.stringLiteral('No valid tests found'),
      ])
    );

    ast.program.body.push(describeSkipBlock);
    const imports = [
      t.importDeclaration(
        [
          t.importSpecifier(vitestTestId, t.identifier('test')),
          t.importSpecifier(vitestDescribeId, t.identifier('describe')),
        ],
        t.stringLiteral('vitest')
      ),
    ];

    ast.program.body.unshift(...imports);
  } else {
    const vitestExpectId = parsed._file.path.scope.generateUidIdentifier('expect');
    const testStoryId = parsed._file.path.scope.generateUidIdentifier('testStory');
    const prepareScriptId = parsed._file.path.scope.generateUidIdentifier('prepareScript');
    const setupPageScriptId = parsed._file.path.scope.generateUidIdentifier('setupPageScript');

    function getTestGuardDeclaration() {
      const isRunningFromThisFileId =
        parsed._file.path.scope.generateUidIdentifier('isRunningFromThisFile');

      // expect.getState().testPath
      const testPathProperty = t.memberExpression(
        t.callExpression(t.memberExpression(vitestExpectId, t.identifier('getState')), []),
        t.identifier('testPath')
      );

      // There is a bug in Vitest where expect.getState().testPath is undefined when called outside of a test function so we add this fallback in the meantime
      // https://github.com/vitest-dev/vitest/issues/6367
      // globalThis.__vitest_worker__.filepath
      const filePathProperty = t.memberExpression(
        t.memberExpression(t.identifier('globalThis'), t.identifier('__vitest_worker__')),
        t.identifier('filepath')
      );

      // Combine testPath and filepath using the ?? operator
      const nullishCoalescingExpression = t.logicalExpression(
        '??',
        // TODO: switch order of testPathProperty and filePathProperty when the bug is fixed
        // https://github.com/vitest-dev/vitest/issues/6367 (or probably just use testPathProperty)
        filePathProperty,
        testPathProperty
      );

      // Create the final expression: convertToFilePath(import.meta.url).includes(...)
      const includesCall = t.callExpression(
        t.memberExpression(
          t.callExpression(t.identifier('convertToFilePath'), [
            t.memberExpression(
              t.memberExpression(t.identifier('import'), t.identifier('meta')),
              t.identifier('url')
            ),
          ]),
          t.identifier('includes')
        ),
        [nullishCoalescingExpression]
      );

      const isRunningFromThisFileDeclaration = t.variableDeclaration('const', [
        t.variableDeclarator(isRunningFromThisFileId, includesCall),
      ]);
      return { isRunningFromThisFileDeclaration, isRunningFromThisFileId };
    }

    const getTestStatementForStory = ({
      testTitle,
      storyId,
      node,
    }: {
      testTitle: string;
      storyId: string;
      node: t.Node;
    }): t.ExpressionStatement => {
      // Create the _test expression directly using the exportName identifier
      const testStoryCall = t.expressionStatement(
        t.callExpression(vitestTestId, [
          t.stringLiteral(testTitle),
          t.arrowFunctionExpression(
            [t.identifier('context')],
            t.callExpression(testStoryId, [
              t.stringLiteral(storyId),
              t.identifier('page'),
              t.identifier('context'),
            ]),
            true // async
          ),
        ])
      );

      // Preserve sourcemaps location
      testStoryCall.loc = node.loc;

      return testStoryCall;
    };

    const { isRunningFromThisFileDeclaration, isRunningFromThisFileId } = getTestGuardDeclaration();

    const storyTestStatements = Object.entries(validStories)
      .map(([exportName, node]) => {
        if (node === null) {
          logger.warn(
            dedent`
            [Storybook]: Could not transform "${exportName}" story into test at "${fileName}".
            Please make sure to define stories in the same file and not re-export stories coming from other files".
          `
          );
          return;
        }

        const storyName = storyNameFromExport(exportName);
        const testTitle = parsed._stories[exportName].name ?? storyName;
        const storyId = toId(parsed._meta?.title || '', storyName);

        return getTestStatementForStory({ testTitle, storyId, node });
      })
      .filter((st) => !!st) as t.ExpressionStatement[];

    // Create browser and page variables
    const browserDeclaration = t.variableDeclaration('let', [
      t.variableDeclarator(t.identifier('browser')),
    ]);

    const pageDeclaration = t.variableDeclaration('let', [
      t.variableDeclarator(t.identifier('page')),
    ]);

    // Create beforeAll hook
    const beforeAllBlock = t.expressionStatement(
      t.callExpression(vitestBeforeAllId, [
        t.arrowFunctionExpression(
          [],
          t.blockStatement([
            t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('options'),
                t.objectExpression([
                  t.objectProperty(t.identifier('headless'), t.booleanLiteral(false)),
                ])
              ),
            ]),
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.identifier('browser'),
                t.awaitExpression(
                  t.callExpression(
                    t.memberExpression(t.identifier('chromium'), t.identifier('launch')),
                    [t.identifier('options')]
                  )
                )
              )
            ),
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.identifier('page'),
                t.awaitExpression(
                  t.callExpression(
                    t.memberExpression(t.identifier('browser'), t.identifier('newPage')),
                    []
                  )
                )
              )
            ),
            t.expressionStatement(
              t.awaitExpression(t.callExpression(prepareScriptId, [t.identifier('page')]))
            ),
            t.expressionStatement(
              t.awaitExpression(t.callExpression(setupPageScriptId, [t.identifier('page')]))
            ),
          ]),
          true
        ),
      ])
    );

    // Create afterAll hook
    const afterAllBlock = t.expressionStatement(
      t.callExpression(vitestAfterAllId, [
        t.arrowFunctionExpression(
          [],
          t.blockStatement([
            t.expressionStatement(
              t.awaitExpression(
                t.callExpression(
                  t.memberExpression(t.identifier('browser'), t.identifier('close')),
                  []
                )
              )
            ),
          ]),
          true
        ),
      ])
    );

    const testBlock = t.ifStatement(
      isRunningFromThisFileId,
      t.blockStatement([
        browserDeclaration,
        pageDeclaration,
        beforeAllBlock,
        afterAllBlock,
        ...storyTestStatements,
      ])
    );

    ast.program.body.push(isRunningFromThisFileDeclaration, testBlock);

    const imports = [
      t.importDeclaration(
        [
          t.importSpecifier(vitestTestId, t.identifier('test')),
          t.importSpecifier(vitestBeforeAllId, t.identifier('beforeAll')),
          t.importSpecifier(vitestAfterAllId, t.identifier('afterAll')),
          t.importSpecifier(vitestExpectId, t.identifier('expect')),
        ],
        t.stringLiteral('vitest')
      ),
      t.importDeclaration(
        [t.importSpecifier(t.identifier('chromium'), t.identifier('chromium'))],
        t.stringLiteral('playwright')
      ),
      t.importDeclaration(
        [
          t.importSpecifier(testStoryId, t.identifier('testStory')),
          t.importSpecifier(prepareScriptId, t.identifier('prepareScript')),
          t.importSpecifier(setupPageScriptId, t.identifier('setupPageScript')),
          t.importSpecifier(t.identifier('convertToFilePath'), t.identifier('convertToFilePath')),
        ],
        t.stringLiteral('@storybook/addon-vitest/internal/playwright-utils')
      ),
    ];

    ast.program.body.unshift(...imports);
  }

  return formatCsf(parsed, { sourceMaps: true, sourceFileName: fileName }, code);
}
