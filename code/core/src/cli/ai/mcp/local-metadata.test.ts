import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { experimental_loadStorybook as loadStorybook } from 'storybook/internal/core-server';

import { loadStorybookAiMetadata, resolveStorybookConfigDir } from './local-metadata.ts';

vi.mock('storybook/internal/core-server', { spy: true });

type LoadedStorybook = Awaited<ReturnType<typeof loadStorybook>>;

beforeEach(() => {
  vi.mocked(loadStorybook).mockReset();
});

function mockLoadedStorybook(apply: ReturnType<typeof vi.fn>) {
  vi.mocked(loadStorybook).mockResolvedValue({
    presets: { apply },
  } as unknown as LoadedStorybook);
}

describe('loadStorybookAiMetadata', () => {
  it('loads AI metadata through the Storybook preset system', async () => {
    const apply = vi.fn().mockResolvedValue({
      instructions: 'Follow the story workflow.',
      tools: [
        { name: 'get-documentation', description: 'Get docs.' },
        {
          name: 'get-storybook-story-instructions',
          description: 'Get story guidance.',
        },
      ],
      localTools: {
        'get-storybook-story-instructions': {
          call: vi.fn().mockResolvedValue({ content: [] }),
        },
      },
    });
    mockLoadedStorybook(apply);

    const metadata = await loadStorybookAiMetadata({ cwd: '/repo' });

    expect(loadStorybook).toHaveBeenCalledWith({ configDir: resolve('/repo/.storybook') });
    expect(apply).toHaveBeenCalledWith('experimental_storybookAi', undefined);
    expect(metadata).toEqual({
      instructions: 'Follow the story workflow.',
      tools: [
        { name: 'get-documentation', description: 'Get docs.' },
        {
          name: 'get-storybook-story-instructions',
          description: 'Get story guidance.',
        },
      ],
      localTools: {
        'get-storybook-story-instructions': {
          call: expect.any(Function),
        },
      },
    });
  });

  it('loads AI metadata from a custom config dir relative to cwd', async () => {
    const apply = vi.fn().mockResolvedValue({ tools: [] });
    mockLoadedStorybook(apply);

    await loadStorybookAiMetadata({ cwd: '/repo', configDir: 'config/storybook' });

    expect(loadStorybook).toHaveBeenCalledWith({ configDir: resolve('/repo/config/storybook') });
  });

  it('normalizes optional metadata fields and hides descriptor-less local tools', async () => {
    const call = vi.fn().mockResolvedValue({ content: [] });
    mockLoadedStorybook(
      vi.fn().mockResolvedValue({
        instructions: 123,
        tools: [{ name: 'get-documentation' }],
        localTools: {
          invalid: {},
          notObject: true,
          'get-documentation': { call },
        },
      })
    );

    const metadata = await loadStorybookAiMetadata({ cwd: '/repo' });

    expect(metadata).toEqual({
      instructions: undefined,
      tools: [{ name: 'get-documentation' }],
      localTools: {
        'get-documentation': { call },
      },
    });
  });

  it('rejects malformed metadata tool descriptors', async () => {
    mockLoadedStorybook(
      vi.fn().mockResolvedValue({
        tools: [{ name: 123 }],
      })
    );

    await expect(loadStorybookAiMetadata({ cwd: '/repo' })).rejects.toThrow(
      'invalid tool descriptor'
    );
  });

  it('rejects malformed visible local tools', async () => {
    mockLoadedStorybook(
      vi.fn().mockResolvedValue({
        tools: [{ name: 'get-storybook-story-instructions' }],
        localTools: {
          'get-storybook-story-instructions': {},
        },
      })
    );

    await expect(loadStorybookAiMetadata({ cwd: '/repo' })).rejects.toThrow('invalid local tool');
  });

  it('returns undefined when no preset provides metadata', async () => {
    mockLoadedStorybook(vi.fn().mockResolvedValue(undefined));

    await expect(loadStorybookAiMetadata({ cwd: '/repo' })).resolves.toBeUndefined();
  });
});

describe('resolveStorybookConfigDir', () => {
  it('defaults to .storybook under the target cwd', () => {
    expect(resolveStorybookConfigDir({ cwd: '/repo' })).toBe(resolve('/repo/.storybook'));
  });

  it('resolves relative config dirs from the target cwd', () => {
    expect(resolveStorybookConfigDir({ cwd: '/repo', configDir: 'config/storybook' })).toBe(
      resolve('/repo/config/storybook')
    );
  });

  it('keeps absolute config dirs unchanged', () => {
    expect(resolveStorybookConfigDir({ cwd: '/repo', configDir: '/custom/.storybook' })).toBe(
      '/custom/.storybook'
    );
  });
});
