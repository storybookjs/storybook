import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

import { ChangeDetectionUnavailableError } from './errors';
import { GitDiffProvider } from './git-diff-provider';

vi.mock('execa', { spy: true });

describe('GitDiffProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the union of staged, unstaged, and untracked files', async () => {
    vi.mocked(execa)
      .mockResolvedValueOnce({ stdout: '/repo' } as never)
      .mockResolvedValueOnce({
        stdout: 'src/Button.tsx\nsrc/NewButton.stories.tsx\n',
      } as never)
      .mockResolvedValueOnce({ stdout: 'src/Button.tsx\nsrc/Button.css\n' } as never)
      .mockResolvedValueOnce({ stdout: 'src/NewButton.stories.tsx\n' } as never);

    const provider = new GitDiffProvider('/repo');

    await expect(provider.getChangedFiles()).resolves.toEqual({
      changed: new Set(['src/Button.tsx', 'src/NewButton.stories.tsx', 'src/Button.css']),
      new: new Set(['src/NewButton.stories.tsx']),
    });
  });

  it('throws a typed unavailable error when git cannot find a repository', async () => {
    vi.mocked(execa).mockRejectedValueOnce(new Error('fatal: not a git repository'));

    const provider = new GitDiffProvider('/repo');

    await expect(provider.getChangedFiles()).rejects.toBeInstanceOf(
      ChangeDetectionUnavailableError
    );
  });
});
