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

let graphRevision = 0;

const mockServices = (docgenService: unknown) => {
  vi.mocked(getService).mockImplementation(((id: string) =>
    id === 'core/module-graph'
      ? { queries: { graphRevision: { get: () => graphRevision } } }
      : docgenService) as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  graphRevision = 0;
  vi.mocked(buildStoryDocsPayload).mockResolvedValue(undefined);
});

const getDocgenPayload = async () => {
  const provider = await experimental_storyDocsProvider(async () => undefined, {} as Options);
  await provider({ entry });
  return vi.mocked(buildStoryDocsPayload).mock.calls.at(-1)![1].getDocgenPayload;
};

describe('experimental_storyDocsProvider', () => {
  it('reuses the shared docgen cache instead of extracting a second time', async () => {
    const extractDocgen = vi.fn();
    const loaded = vi.fn(async () => ({ id: 'cached', name: 'Button' }));
    mockServices({ commands: { extractDocgen }, queries: { docgen: { loaded } } });

    await expect((await getDocgenPayload())('cached')).resolves.toEqual({
      id: 'cached',
      name: 'Button',
    });
    expect(loaded).toHaveBeenCalledWith({ id: 'cached' });
    expect(extractDocgen).not.toHaveBeenCalled();
  });

  it('extracts current docgen once the story subgraph changed', async () => {
    const extractDocgen = vi.fn(async () => ({ id: 'edited', name: 'Edited' }));
    const loaded = vi.fn(async () => ({ id: 'edited', name: 'Cached' }));
    mockServices({ commands: { extractDocgen }, queries: { docgen: { loaded } } });
    const pull = await getDocgenPayload();

    await expect(pull('edited')).resolves.toEqual({ id: 'edited', name: 'Cached' });

    graphRevision = 1;
    await expect(pull('edited')).resolves.toEqual({ id: 'edited', name: 'Edited' });
    expect(extractDocgen).toHaveBeenCalledWith({ id: 'edited' });

    await expect(pull('edited')).resolves.toEqual({ id: 'edited', name: 'Cached' });
    expect(extractDocgen).toHaveBeenCalledOnce();
  });

  it('keeps extracting after a failed pull instead of falling back to the cache', async () => {
    const extractDocgen = vi
      .fn()
      .mockRejectedValueOnce(new Error('docgen worker restarted'))
      .mockResolvedValue({ id: 'retried', name: 'Edited' });
    const loaded = vi.fn(async () => ({ id: 'retried', name: 'Cached' }));
    mockServices({ commands: { extractDocgen }, queries: { docgen: { loaded } } });
    const pull = await getDocgenPayload();

    await expect(pull('retried')).resolves.toEqual({ id: 'retried', name: 'Cached' });

    graphRevision = 1;
    await expect(pull('retried')).rejects.toThrow('docgen worker restarted');

    await expect(pull('retried')).resolves.toEqual({ id: 'retried', name: 'Edited' });
    expect(extractDocgen).toHaveBeenCalledTimes(2);
    expect(loaded).toHaveBeenCalledOnce();
  });

  it('propagates extraction failures so the payload is not cached', async () => {
    mockServices({
      queries: {
        docgen: {
          loaded: vi.fn(async () => {
            throw new Error('docgen worker is no longer running');
          }),
        },
      },
    });

    await expect((await getDocgenPayload())('failing')).rejects.toThrow(
      'docgen worker is no longer running'
    );
  });
});
