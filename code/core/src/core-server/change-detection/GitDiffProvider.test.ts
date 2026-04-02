import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';

vi.mock('execa', { spy: true });

type ExecaMockResult = { stdout: string } | { error: Error };

function resolved(stdout: string): ExecaMockResult {
  return { stdout };
}

function rejected(error: Error): ExecaMockResult {
  return { error };
}

describe('GitDiffProvider', () => {
  let repoRootResult: ExecaMockResult;
  let stagedResult: ExecaMockResult;
  let unstagedResult: ExecaMockResult;
  let untrackedResult: ExecaMockResult;
  let stagedAddedResult: ExecaMockResult;

  beforeEach(() => {
    vi.clearAllMocks();
    repoRootResult = resolved('/repo');
    stagedResult = resolved('src/Button.tsx\nsrc/NewButton.stories.tsx\n');
    unstagedResult = resolved('src/Button.tsx\n');
    untrackedResult = resolved('src/Button.css\n');
    stagedAddedResult = resolved('src/NewButton.stories.tsx\n');

    vi.mocked(execa).mockImplementation(((_command: string | URL, ...rest: unknown[]) => {
      const args = Array.isArray(rest[0]) ? rest[0] : [];
      const gitArgs = args.join(' ');
      const result =
        gitArgs === 'rev-parse --show-toplevel'
          ? repoRootResult
          : gitArgs === 'diff --name-only --diff-filter=d --cached'
            ? stagedResult
            : gitArgs === 'diff --name-only --diff-filter=d'
              ? unstagedResult
              : gitArgs === 'ls-files --others --exclude-standard'
                ? untrackedResult
                : gitArgs === 'diff --name-only --diff-filter=A --cached'
                  ? stagedAddedResult
                  : undefined;

      if (!result) {
        throw new Error(`Unexpected git args: ${gitArgs}`);
      }

      if ('error' in result) {
        throw result.error;
      }

      return Promise.resolve(result) as ReturnType<typeof execa>;
    }) as unknown as typeof execa);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the union of staged, unstaged, and untracked files', async () => {
    const provider = new GitDiffProvider('/repo');

    await expect(provider.getChangedFiles()).resolves.toEqual({
      changed: new Set(['src/Button.tsx', 'src/NewButton.stories.tsx']),
      new: new Set(['src/Button.css', 'src/NewButton.stories.tsx']),
    });
  });

  it('throws a typed unavailable error when git cannot find a repository', async () => {
    repoRootResult = rejected(new Error('fatal: not a git repository'));

    const provider = new GitDiffProvider('/repo');

    await expect(provider.getChangedFiles()).rejects.toBeInstanceOf(
      ChangeDetectionUnavailableError
    );
  });

  it('attributes staged diff failures to the specific git command', async () => {
    stagedResult = rejected(new Error('index is locked'));

    const provider = new GitDiffProvider('/repo');

    await expect(provider.getChangedFiles()).rejects.toEqual(
      expect.objectContaining({
        name: 'ChangeDetectionFailureError',
        message: expect.stringContaining('git diff --name-only --diff-filter=d --cached failed'),
      })
    );
    await expect(provider.getChangedFiles()).rejects.toBeInstanceOf(ChangeDetectionFailureError);
  });
});
