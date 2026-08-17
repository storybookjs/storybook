import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCodeWorkspaces } from '../../utils/workspace.ts';
import { run as isVersionPublished } from '../is-version-published.ts';
import { listUnpublishedPackages } from '../npm-registry.ts';

vi.mock('../../utils/workspace.ts', { spy: true });
vi.mock('../npm-registry.ts', { spy: true });

beforeEach(() => {
  vi.mocked(getCodeWorkspaces).mockReset();
  vi.mocked(listUnpublishedPackages).mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(getCodeWorkspaces).mockResolvedValue([
    { name: 'storybook', location: '.' },
    { name: '@storybook/react', location: 'renderers/react' },
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('is-version-published', () => {
  it('reports published when every public workspace is on npm', async () => {
    vi.mocked(listUnpublishedPackages).mockResolvedValue([]);

    await expect(isVersionPublished(['1.0.0'], {})).resolves.toBe(true);
    expect(listUnpublishedPackages).toHaveBeenCalledWith({
      packageNames: ['storybook', '@storybook/react'],
      version: '1.0.0',
      verbose: undefined,
    });
  });

  it('reports unpublished when any public workspace is missing', async () => {
    vi.mocked(listUnpublishedPackages).mockResolvedValue(['storybook']);

    await expect(isVersionPublished(['1.0.0'], {})).resolves.toBe(false);
  });
});
