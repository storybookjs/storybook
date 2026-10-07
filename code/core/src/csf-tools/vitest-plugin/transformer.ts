/* eslint-disable local-rules/no-uncategorized-errors */
import { getStoryTitle } from 'storybook/internal/common';
import { combineTags } from 'storybook/internal/csf/csf-utils';
import { logger } from 'storybook/internal/node-logger';
import type { StoriesEntry, Tag } from 'storybook/internal/types';

import { decode, encode } from '@jridgewell/sourcemap-codec';
import { dedent } from 'ts-dedent';

import { type StoryTest, loadCsf } from '../CsfFile.ts';
import { type Node, identifierKey, locationOf } from '../estree/ast.ts';
import { type SourceEditor, appendMembers, prependStatement } from '../estree/editor.ts';
import { generateUid } from '../estree/scope.ts';

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
 * We add double space characters so that it's possible to do a regex for all test run use cases.
 * Otherwise, if there were two unrelated stories like "Primary Button" and "Primary Button Mobile",
 * once you run tests for "Primary Button" and its children it would also match "Primary Button
 * Mobile". As it turns out, this limitation is also present in the Vitest VSCode extension and the
 * issue would occur with normal vitest tests as well, but because we use double spaces, we
 * circumvent the issue.
 */
const DOUBLE_SPACES = '  ';

const q = (value: string) => JSON.stringify(value);

/**
 * In Storybook users might be importing stories from other story files. As a side effect, tests can
 * get re-triggered. To avoid this, we add a guard to only run tests if the current file is the one
 * running the test.
 *
 * Const isRunningFromThisFile = import.meta.url.includes(expect.getState().testPath ??
 * globalThis.**vitest_worker**.filepath) if(isRunningFromThisFile) { ... }
 */
export function createTestGuardDeclaration(
  identifier: string,
  expectId: string,
  convertToFilePathId: string
): string {
  // There is a bug in Vitest where expect.getState().testPath is undefined when called outside of a test function so we add this fallback in the meantime
  // https://github.com/vitest-dev/vitest/issues/6367
  // TODO: switch order of testPath and filepath when the bug is fixed (or probably just use testPath)
  return `const ${identifier} = ${convertToFilePathId}(import.meta.url).includes(globalThis.__vitest_worker__.filepath ?? ${expectId}.getState().testPath);`;
}

// Generated source with lines whose source map should point at a given source node.
export class GeneratedTail {
  lines: { text: string; target?: Node }[] = [];

  push(text: string, target?: Node) {
    this.lines.push({ text, target });
  }
}

/**
 * Print the edited file followed by generated statements. Generated lines map to their target
 * node, so Vitest reports each test at the story it was generated from.
 */
export const printWithTail = (editor: SourceEditor, tail: GeneratedTail, fileName: string) => {
  const head = editor.toString();
  const map = editor.edits.generateMap({ hires: true, source: fileName, includeContent: true });
  const decoded = decode(map.mappings);
  const firstLine = head.split('\n').length;
  const separator = head.endsWith('\n') ? '' : '\n';
  tail.lines.forEach(({ text, target }, index) => {
    const line = firstLine - (separator ? 0 : 1) + index;
    while (decoded.length <= line) {
      decoded.push([]);
    }
    if (target) {
      const { start } = locationOf(
        editor.code,
        (target as { start: number }).start,
        (target as { start: number }).start
      );
      decoded[line] = [[/^\s*/.exec(text)![0].length, 0, start.line - 1, start.column]];
    }
  });
  map.mappings = encode(decoded);
  return {
    code: `${head}${separator}${tail.lines.map(({ text }) => text).join('\n')}\n`,
    map,
  };
};

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
}): Promise<ReturnType<typeof printWithTail>> {
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

  const editor = parsed._editor;
  const metaExportName = parsed._metaVariableName!;
  const metaNode = parsed._metaNode;

  if (!metaNode || parsed._metaNodeIsSynthetic || !parsed._meta) {
    throw new Error(
      'The Storybook vitest plugin could not detect the meta (default export) object in the story file. \n\nPlease make sure you have a default export with the meta object. If you are using a different export format that is not supported, please file an issue with details about your use case.'
    );
  }

  const metaTitleProperty = metaNode.properties.find(
    (prop) => prop.type === 'Property' && identifierKey(prop) === 'title'
  );

  const metaTitle = q(parsed._meta?.title || 'unknown');
  if (!metaTitleProperty) {
    appendMembers(editor, metaNode, [`title: ${metaTitle}`]);
  } else if (metaTitleProperty.type === 'Property' && !metaTitleProperty.method) {
    // If the title is present in meta, overwrite it because autotitle can still affect existing titles
    if (metaTitleProperty.shorthand) {
      editor.edits.overwrite(metaTitleProperty.start, metaTitleProperty.end, `title: ${metaTitle}`);
    } else {
      editor.edits.overwrite(metaTitleProperty.value.start, metaTitleProperty.value.end, metaTitle);
    }
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

  const scopes = editor.scopes;
  const vitestTestId = generateUid(scopes, 'test');
  const vitestDescribeId = generateUid(scopes, 'describe');
  const tail = new GeneratedTail();

  // if no valid stories are found, we just add describe.skip() to the file to avoid empty test files
  if (Object.keys(validStories).length === 0) {
    tail.push(`${vitestDescribeId}.skip(${q('No valid tests found')});`);
    prependStatement(
      editor,
      `import { test as ${vitestTestId}, describe as ${vitestDescribeId} } from "vitest";`
    );
    return printWithTail(editor, tail, fileName);
  }

  const vitestExpectId = generateUid(scopes, 'expect');
  const testStoryId = generateUid(scopes, 'testStory');
  const isRunningFromThisFileId = generateUid(scopes, 'isRunningFromThisFile');
  const skipTags = JSON.stringify(tagsFilter.skip);
  const componentPath = parsed._rawComponentPath;
  const componentName = parsed._componentImportSpecifier?.local.name;

  tail.push(
    createTestGuardDeclaration(isRunningFromThisFileId, vitestExpectId, 'convertToFilePath')
  );

  const testStoryCall = (
    localName: string,
    exportName: string,
    storyId: string,
    testName?: string
  ) => {
    const properties = [
      `exportName: ${q(exportName)}`,
      `story: ${localName}`,
      `meta: ${metaExportName}`,
      `skipTags: ${skipTags}`,
      `storyId: ${q(storyId)}`,
      ...(componentPath ? [`componentPath: ${q(componentPath)}`] : []),
      ...(componentName ? [`componentName: ${q(componentName)}`] : []),
      ...(testName ? [`testName: ${q(testName)}`] : []),
    ];
    return `${testStoryId}({ ${properties.join(', ')} })`;
  };

  tail.push(`if (${isRunningFromThisFileId}) {`);
  for (const [exportName, node] of Object.entries(validStories)) {
    if (node === null || node === undefined) {
      logger.warn(
        dedent`
          [Storybook]: Could not transform "${exportName}" story into test at "${fileName}".
          Please make sure to define stories in the same file and not re-export stories coming from other files".
        `
      );
      continue;
    }

    const localName = parsed._stories[exportName].localName ?? exportName;
    // use the story's name as the test title for vitest, and fallback to exportName
    const testTitle = parsed._stories[exportName].name ?? exportName;
    const storyId = parsed._stories[exportName].id;
    const tests: StoryTest[] = parsed.getStoryTests(exportName);

    if (tests?.length > 0) {
      tail.push(`  ${vitestDescribeId}(${q(`${testTitle}${DOUBLE_SPACES}`)}, () => {`, node);
      tail.push(
        `    ${vitestTestId}("base story", ${testStoryCall(localName, exportName, storyId)});`,
        node
      );
      for (const { name: testName, node: testNode, id: testId } of tests) {
        tail.push(
          `    ${vitestTestId}(${q(testName)}, ${testStoryCall(localName, exportName, testId, testName)});`,
          testNode
        );
      }
      tail.push('  });');
      continue;
    }

    tail.push(
      `  ${vitestTestId}(${q(testTitle)}, ${testStoryCall(localName, exportName, storyId)});`,
      node
    );
  }
  tail.push('}');

  const hasTests = Object.keys(validStories).some(
    (exportName) => parsed.getStoryTests(exportName).length > 0
  );

  prependStatement(
    editor,
    [
      `import { test as ${vitestTestId}, expect as ${vitestExpectId}${hasTests ? `, describe as ${vitestDescribeId}` : ''} } from "vitest";`,
      `import { testStory as ${testStoryId}, convertToFilePath } from "@storybook/addon-vitest/internal/test-utils";`,
    ].join('\n')
  );

  return printWithTail(editor, tail, fileName);
}
