import type { IndexEntry, Options } from '@storybook/core/internal/types';

import { fileURLToPath } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@storybook/core/internal/node-logger';

import {
  createTestInstanceContext,
  runInTestInstance,
} from '../../../../core/src/shared/instance-context.test-helpers.ts';
import { buildStoryDocsPayload } from './story-docs/build-story-docs.ts';
import { experimental_storyDocsProvider } from './story-docs-provider.ts';
import { DOCGEN_WORKER_SPECIFIER } from './worker-specifier.ts';

vi.mock('@storybook/core/internal/node-logger', { spy: true });
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

/** An instance whose plugins registered the Web Components docgen worker. */
const withWorkerInstance = () => ({
  ...createTestInstanceContext(),
  storybook: {
    callHook: async () => [
      { moduleSpecifier: fileURLToPath(import.meta.resolve(DOCGEN_WORKER_SPECIFIER)) },
    ],
  } as never,
});

describe('experimental_storyDocsProvider', () => {
  it('logs file-level story-docs failures before falling back', async () => {
    vi.mocked(buildStoryDocsPayload).mockRejectedValue(new Error('parse failed'));
    const nextStoryDocs = vi.fn(async () => ({ id: 'downstream' }));
    const provider = await runInTestInstance(
      () => experimental_storyDocsProvider(nextStoryDocs as never, {} as Options),
      withWorkerInstance()
    );

    await expect(provider({ entry })).resolves.toEqual({ id: 'downstream' });

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Web Components story snippets are unavailable for ./input.stories.ts'
      )
    );
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('parse failed'));
  });
});
