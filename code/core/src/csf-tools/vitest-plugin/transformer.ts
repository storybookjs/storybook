/* eslint-disable local-rules/no-uncategorized-errors */

/* eslint-disable no-underscore-dangle */
import { types as t } from '@storybook/core/babel';
import { getStoryTitle } from '@storybook/core/common';
import type { StoriesEntry, Tag } from '@storybook/core/types';
import { combineTags } from '@storybook/csf';

import { dedent } from 'ts-dedent';

import { formatCsf, loadCsf } from '../CsfFile';

const logger = console;

type TagsFilter = {
  include: string[];
  exclude: string[];
  skip: string[];
};

const isValidTest = (storyTags: string[], tagsFilter: TagsFilter) => {
  const isIncluded =
    tagsFilter?.include.length === 0 || tagsFilter?.include.some((tag) => storyTags.includes(tag));
  const isNotExcluded = tagsFilter?.exclude.every((tag) => !storyTags.includes(tag));

  return isIncluded && isNotExcluded;
};
/**
 * TODO: the functionality in this file can be moved back to the vitest plugin itself It can use
 * `storybook/internal/babel` for all it's babel needs, without duplicating babel embedding in our
 * bundles.
 */

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
          t.memberExpression(
            t.memberExpression(t.identifier('import'), t.identifier('meta')),
            t.identifier('url')
          ),
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
      exportName,
      testTitle,
      node,
    }: {
      exportName: string;
      testTitle: string;
      node: t.Node;
    }): t.ExpressionStatement => {
      // Create the _test expression directly using the exportName identifier
      const testStoryCall = t.expressionStatement(
        t.callExpression(vitestTestId, [
          t.stringLiteral(testTitle),
          t.callExpression(testStoryId, [
            t.stringLiteral(exportName),
            t.identifier(exportName),
            t.identifier(metaExportName),
            skipTagsId,
          ]),
        ])
      );

      // Preserve sourcemaps location
      testStoryCall.loc = node.loc;

      // Return just the testStoryCall as composeStoryCall is not needed
      return testStoryCall;
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

        // use the story's name as the test title for vitest, and fallback to exportName
        const testTitle = parsed._stories[exportName].name ?? exportName;
        return getTestStatementForStory({ testTitle, exportName, node });
      })
      .filter((st) => !!st) as t.ExpressionStatement[];

    const testBlock = t.ifStatement(isRunningFromThisFileId, t.blockStatement(storyTestStatements));

    ast.program.body.push(testBlock);

    const imports = [
      t.importDeclaration(
        [
          t.importSpecifier(vitestTestId, t.identifier('test')),
          t.importSpecifier(vitestExpectId, t.identifier('expect')),
        ],
        t.stringLiteral('vitest')
      ),
      t.importDeclaration(
        [t.importSpecifier(testStoryId, t.identifier('testStory'))],
        t.stringLiteral('@storybook/experimental-addon-test/internal/test-utils')
      ),
    ];

    ast.program.body.unshift(...imports);
  }

  return formatCsf(parsed, { sourceMaps: true, sourceFileName: fileName }, code);
}
