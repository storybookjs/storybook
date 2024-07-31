import { describe, it, expect } from 'vitest';
import { IndexingError, MultipleIndexingError } from '../IndexingError';

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
});
