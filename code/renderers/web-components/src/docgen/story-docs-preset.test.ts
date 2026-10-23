import type { IndexEntry, Options } from 'storybook/internal/types';

import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';
import { experimental_storyDocsProvider } from './story-docs-preset.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./story-docs/build-story-docs.ts', { spy: true });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(logger.debug).mockImplementation(() => {});
});

const entry: IndexEntry = {
  id: 'example-card--primary',
  name: 'Primary',
  title: 'Example/Card',
  type: 'story',
  subtype: 'story',
  importPath: './input.stories.ts',
};

const options = (): Options =>
  ({
    presets: {
      apply: async <T>(key: string, fallback: T): Promise<T> =>
        key === 'experimental_docgenProvider'
          ? ([
              {
                moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)),
              },
            ] as T)
          : fallback,
    },
  }) as Options;

describe('experimental_storyDocsProvider', () => {
  it('logs file-level story-docs failures before falling back', async () => {
    vi.mocked(buildStoryDocsPayload).mockRejectedValue(new Error('parse failed'));
    const nextStoryDocs = vi.fn(async () => ({ id: 'downstream' }));
    const provider = await experimental_storyDocsProvider(nextStoryDocs as never, options());

    await expect(provider({ entry })).resolves.toEqual({ id: 'downstream' });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Web Components story snippets are unavailable for ./input.stories.ts'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('parse failed'));
  });
});
