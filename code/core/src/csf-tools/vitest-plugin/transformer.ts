/* eslint-disable local-rules/no-uncategorized-errors */
import { types as t } from 'storybook/internal/babel';
import { getStoryTitle } from 'storybook/internal/common';
import { combineTags } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';
import type { StoriesEntry, Tag } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { type StoryTest, formatCsf, loadCsf } from '../CsfFile';

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
/**
 * TODO: the functionality in this file can be moved back to the vitest plugin itself It can use
 * `storybook/internal/babel` for all it's babel needs, without duplicating babel embedding in our
 * bundles.
 */

/**
 * We add double space characters so that it's possible to do a regex for all test run use cases.
 * Otherwise, if there were two unrelated stories like "Primary Button" and "Primary Button Mobile",
 * once you run tests for "Primary Button" and its children it would also match "Primary Button
 * Mobile". As it turns out, this limitation is also present in the Vitest VSCode extension and the
 * issue would occur with normal vitest tests as well, but because we use double spaces, we
 * circumvent the issue.
 */
const DOUBLE_SPACES = '  ';
const getLiteralWithZeroWidthSpace = (testTitle: string) =>
  t.stringLiteral(`${testTitle}${DOUBLE_SPACES}`);

export async function vitestTransform({
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

  const metaExportName = parsed._metaVariableName!;

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
  Object.keys(parsed._stories).forEach((key) => {
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

    return formatCsf(parsed, { sourceMaps: true, sourceFileName: fileName }, code);
  }

  const vitestExpectId = parsed._file.path.scope.generateUidIdentifier('expect');
  const testStoryId = parsed._file.path.scope.generateUidIdentifier('testStory');
  const skipTagsId = t.identifier(JSON.stringify(tagsFilter.skip));

  /**
   * In Storybook users might be importing stories from other story files. As a side effect, tests
   * can get re-triggered. To avoid this, we add a guard to only run tests if the current file is
   * the one running the test.
   *
   * Const isRunningFromThisFile = import.meta.url.includes(expect.getState().testPath ??
   * globalThis.**vitest_worker**.filepath) if(isRunningFromThisFile) { ... }
   */
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

    // Create the final expression: import.meta.url.includes(...)
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

  const { isRunningFromThisFileDeclaration, isRunningFromThisFileId } = getTestGuardDeclaration();

  ast.program.body.push(isRunningFromThisFileDeclaration);

  const getTestStatementForStory = ({
    localName,
    exportName,
    testTitle,
    node,
    overrideSourcemap = true,
    storyId,
  }: {
    localName: string;
    exportName: string;
    testTitle: string;
    node: t.Node;
    overrideSourcemap?: boolean;
    storyId: string;
  }): t.ExpressionStatement => {
    // Create the _test expression directly using the exportName identifier
    const testStoryCall = t.expressionStatement(
      t.callExpression(vitestTestId, [
        t.stringLiteral(testTitle),
        t.callExpression(testStoryId, [
          t.stringLiteral(exportName),
          t.identifier(localName),
          t.identifier(metaExportName),
          skipTagsId,
          t.stringLiteral(storyId),
        ]),
      ])
    );

    if (overrideSourcemap) {
      // Preserve sourcemaps location
      testStoryCall.loc = node.loc;
    }

    // Return just the testStoryCall as composeStoryCall is not needed
    return testStoryCall;
  };

  const getDescribeStatementForStory = (options: {
    localName: string;
    describeTitle: string;
    exportName: string;
    tests: StoryTest[];
    node: t.Node;
    parentStoryId: string;
  }): t.ExpressionStatement => {
    const { localName, describeTitle, exportName, tests, node, parentStoryId } = options;
    const describeBlock = t.callExpression(vitestDescribeId, [
      getLiteralWithZeroWidthSpace(describeTitle),
      t.arrowFunctionExpression(
        [],
        t.blockStatement([
          getTestStatementForStory({
            ...options,
            testTitle: 'base story',
            overrideSourcemap: false,
            storyId: parentStoryId,
          }),
          ...tests.map(({ name: testName, node: testNode, id: storyId }) => {
            const testStatement = t.expressionStatement(
              t.callExpression(vitestTestId, [
                t.stringLiteral(testName),
                t.callExpression(testStoryId, [
                  t.stringLiteral(exportName),
                  t.identifier(localName),
                  t.identifier(metaExportName),
                  t.arrayExpression([]),
                  t.stringLiteral(storyId),
                  t.stringLiteral(testName),
                ]),
              ])
            );
            testStatement.loc = testNode.loc;
            return testStatement;
          }),
        ])
      ),
    ]);

    describeBlock.loc = node.loc;
    return t.expressionStatement(describeBlock);
  };

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

      const localName = parsed._stories[exportName].localName ?? exportName;
      // use the story's name as the test title for vitest, and fallback to exportName
      const testTitle = parsed._stories[exportName].name ?? exportName;
      const storyId = parsed._stories[exportName].id;
      const tests = parsed.getStoryTests(exportName);

      if (tests?.length > 0) {
        return getDescribeStatementForStory({
          localName,
          describeTitle: testTitle,
          exportName,
          tests,
          node,
          parentStoryId: storyId,
        });
      }

      return getTestStatementForStory({
        testTitle,
        localName,
        exportName,
        node,
        storyId,
      });
    })
    .filter((st) => !!st) as t.ExpressionStatement[];

  const testBlock = t.ifStatement(isRunningFromThisFileId, t.blockStatement(storyTestStatements));

  ast.program.body.push(testBlock);

  const hasTests = Object.keys(validStories).some(
    (exportName) => parsed.getStoryTests(exportName).length > 0
  );

  const imports = [
    t.importDeclaration(
      [
        t.importSpecifier(vitestTestId, t.identifier('test')),
        t.importSpecifier(vitestExpectId, t.identifier('expect')),
        ...(hasTests ? [t.importSpecifier(vitestDescribeId, t.identifier('describe'))] : []),
      ],
      t.stringLiteral('vitest')
    ),
    t.importDeclaration(
      [
        t.importSpecifier(testStoryId, t.identifier('testStory')),
        t.importSpecifier(t.identifier('convertToFilePath'), t.identifier('convertToFilePath')),
      ],
      t.stringLiteral('@storybook/addon-vitest/internal/test-utils')
    ),
  ];

  ast.program.body.unshift(...imports);

  return formatCsf(parsed, { sourceMaps: true, sourceFileName: fileName }, code);
}
