import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getService } from 'storybook/internal/core-server';
import type { IndexEntry, Options } from 'storybook/internal/types';

import { buildStoryDocsPayload } from './story-docs-build.ts';
import { experimental_storyDocsProvider } from './story-docs-preset.ts';

vi.mock('storybook/internal/core-server', { spy: true });
vi.mock('./story-docs-build.ts', () => ({ buildStoryDocsPayload: vi.fn() }));

const entry: IndexEntry = {
  id: 'button--primary',
  name: 'Primary',
  title: 'Button',
  type: 'story',
  subtype: 'story',
  importPath: './button.stories.ts',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildStoryDocsPayload).mockResolvedValue(undefined);
});

const getDocgenPayload = async () => {
  const provider = await experimental_storyDocsProvider(async () => undefined, {} as Options);
  await provider({ entry });
  return vi.mocked(buildStoryDocsPayload).mock.calls.at(-1)![1].getDocgenPayload;
};

describe('experimental_storyDocsProvider', () => {
  it('extracts current docgen instead of loading a cached query value', async () => {
    const extractDocgen = vi.fn(async () => ({ id: 'button', name: 'Button' }));
    const loaded = vi.fn();
    vi.mocked(getService).mockReturnValue({
      commands: { extractDocgen },
      queries: { docgen: { loaded } },
    } as never);

    await expect((await getDocgenPayload())('button')).resolves.toEqual({
      id: 'button',
      name: 'Button',
    });
    expect(extractDocgen).toHaveBeenCalledWith({ id: 'button' });
    expect(loaded).not.toHaveBeenCalled();
  });

  it('propagates extraction failures so the payload is not cached', async () => {
    vi.mocked(getService).mockReturnValue({
      commands: {
        extractDocgen: vi.fn(async () => {
          throw new Error('docgen worker is no longer running');
        }),
      },
    } as never);

    await expect((await getDocgenPayload())('button')).rejects.toThrow(
      'docgen worker is no longer running'
    );
  });
});
