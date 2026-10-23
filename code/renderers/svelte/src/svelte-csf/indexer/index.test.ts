import path from 'node:path';
import url from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { IndexerOptions } from 'storybook/internal/types';

import { createIndexer } from './index.ts';
import { parseForIndexer } from './parser.ts';

vi.mock('./parser.ts', () => ({ parseForIndexer: vi.fn() }));

const FILENAME = path.resolve('/project/src/Button.stories.svelte');

const indexWithParserError = async (cause: unknown) => {
  vi.mocked(parseForIndexer).mockRejectedValue(cause);
  return createIndexer()
    .createIndex(FILENAME, { makeTitle: (title) => title ?? '' } as IndexerOptions)
    .then(
      () => expect.unreachable('createIndex should reject'),
      (error: Error) => error
    );
};

describe('createIndexer', () => {
  beforeEach(() => {
    // The shared vitest setup replaces `logger` with a mock that has no `shouldLog`.
    logger.shouldLog = vi.fn(() => false);
  });

  describe('when the parser throws an unrecognized error', () => {
    it('shows the original error and the stories file in the message', async () => {
      const error = await indexWithParserError(new Error('boom'));

      expect(error.name).toContain('SB_SVELTE_CSF_PARSER_EXTRACT_SVELTE_0009');
      expect(error.message).toContain('Error: boom');
      expect(error.message).toContain(url.pathToFileURL(FILENAME).href);
    });

    it('keeps the original error as the cause', async () => {
      const cause = new Error('boom');

      const error = await indexWithParserError(cause);

      expect(error.cause).toBe(cause);
    });

    it.each([
      ['a string', 'boom', 'boom'],
      ['an object', { code: 'E_BOOM' }, "code: 'E_BOOM'"],
      [
        'an object without a prototype',
        Object.assign(Object.create(null), { code: 'E_BOOM' }),
        'E_BOOM',
      ],
      ['undefined', undefined, 'undefined'],
      [
        'an object whose custom inspect throws',
        {
          [Symbol.for('nodejs.util.inspect.custom')]: () => {
            throw new Error('inspect failed');
          },
        },
        'could not be printed',
      ],
    ])('describes a cause that is %s', async (_, cause, expected) => {
      const error = await indexWithParserError(cause);

      expect(error.message).toContain(expected);
      expect(error.cause).toBe(cause);
    });

    it('shows the stack of the original error when debug logging is on', async () => {
      vi.mocked(logger.shouldLog).mockImplementation((level) => level === 'debug');
      const cause = new Error('boom');

      const error = await indexWithParserError(cause);

      expect(error.message).toContain(cause.stack!.split('\n')[1].trim());
    });
  });
});
