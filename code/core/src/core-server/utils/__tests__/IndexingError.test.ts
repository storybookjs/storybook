import { describe, expect, it } from 'vitest';

import { IndexingError, MultipleIndexingError } from '../IndexingError.ts';

it('formats single file errors', () => {
  const error = new IndexingError('parse error', ['./stories/File.stories.ts']);

  expect(error.toString()).toMatchInlineSnapshot(`"./stories/File.stories.ts: parse error"`);
});

it('formats multi file errors', () => {
  const error = new IndexingError('Duplicate stories', [
    './stories/File.stories.ts',
    '/path/to/other/File.stories.ts',
  ]);

  expect(error.toString()).toMatchInlineSnapshot(
    `"./stories/File.stories.ts,/path/to/other/File.stories.ts: Duplicate stories"`
  );
});

describe('formatIndexingErrors', () => {
  it('formats one error with trace', () => {
    const stack = `Error: parse error
          at Object.<anonymous> (/user/storybookjs/storybook/code/lib/core-server/src/utils/__tests__/IndexingError.test.ts:26:25)
          at Promise.then.completed (/user/storybookjs/storybook/code/node_modules/jest-circus/build/utils.js:293:28)
          at new Promise (<anonymous>)`;
    const error = new IndexingError('parse error', ['./stories/File.stories.ts'], stack);
    const multiError = new MultipleIndexingError([error]);

    expect(multiError.toString()).toMatchInlineSnapshot(`
      "Unable to index ./stories/File.stories.ts:
        Error: parse error
                at Object.<anonymous> (/user/storybookjs/storybook/code/lib/core-server/src/utils/__tests__/IndexingError.test.ts:26:25)
                at Promise.then.completed (/user/storybookjs/storybook/code/node_modules/jest-circus/build/utils.js:293:28)
                at new Promise (<anonymous>)"
    `);
  });

  it('formats multiple errors without trace', () => {
    const errors = [0, 1, 2].map((index) => {
      return new IndexingError('parse error', [`./stories/File-${index}.stories.ts`]);
    });
    const multiError = new MultipleIndexingError(errors);

    expect(multiError.toString()).toMatchInlineSnapshot(`
      "Unable to index files:
      - ./stories/File-0.stories.ts: parse error
      - ./stories/File-1.stories.ts: parse error
      - ./stories/File-2.stories.ts: parse error"
    `);
  });

  it('lists the other files with the same Storybook error and message by path', () => {
    const notStoriesFile = { code: 'SB_X_0001', messageWithoutPath: 'is not a stories file' };
    const errors = [
      new IndexingError(
        './A is not a stories file',
        ['./A.stories.svelte'],
        undefined,
        notStoriesFile
      ),
      new IndexingError('parse error', ['./B.stories.ts']),
      new IndexingError(
        './C is not a stories file',
        ['./C.stories.svelte'],
        undefined,
        notStoriesFile
      ),
      new IndexingError(
        './D is not a stories file',
        ['./D.stories.svelte'],
        undefined,
        notStoriesFile
      ),
      new IndexingError('E: Unexpected token at 1:1', ['./E.stories.svelte'], undefined, {
        code: 'SB_X_0002',
        messageWithoutPath: 'Unexpected token at 1:1',
      }),
      new IndexingError('F: Unexpected token at 7:3', ['./F.stories.svelte'], undefined, {
        code: 'SB_X_0002',
        messageWithoutPath: 'Unexpected token at 7:3',
      }),
    ];
    const multiError = new MultipleIndexingError(errors);

    expect(multiError.toString()).toMatchInlineSnapshot(`
      "Unable to index files:
      - ./A.stories.svelte: ./A is not a stories file
      - ./C.stories.svelte: the same error as above (SB_X_0001)
      - ./D.stories.svelte: the same error as above (SB_X_0001)
      - ./B.stories.ts: parse error
      - ./E.stories.svelte: E: Unexpected token at 1:1
      - ./F.stories.svelte: F: Unexpected token at 7:3"
    `);
  });
});
