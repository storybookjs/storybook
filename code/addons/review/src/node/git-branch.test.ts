import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: mockExecFile,
}));

import { currentGitBranch } from './git-branch.ts';

type ExecFileCallback = (error: Error | null, result?: { stdout: string }) => void;

describe('currentGitBranch', () => {
  beforeEach(() => {
    mockExecFile.mockReset();
  });

  it('returns the current branch name in a git repo', async () => {
    mockExecFile.mockImplementation(
      (_file: string, _args: string[], _options: { cwd: string }, callback: ExecFileCallback) => {
        callback(null, { stdout: 'feature/review-state\n' });
      }
    );

    await expect(currentGitBranch('/repo')).resolves.toBe('feature/review-state');
    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd: '/repo' },
      expect.any(Function)
    );
  });

  it('returns undefined on detached HEAD', async () => {
    mockExecFile.mockImplementation(
      (_file: string, _args: string[], _options: { cwd: string }, callback: ExecFileCallback) => {
        callback(null, { stdout: 'HEAD\n' });
      }
    );

    await expect(currentGitBranch('/repo')).resolves.toBeUndefined();
  });

  it('returns undefined when git command fails (e.g. non-git directory)', async () => {
    mockExecFile.mockImplementation(
      (_file: string, _args: string[], _options: { cwd: string }, callback: ExecFileCallback) => {
        callback(new Error('fatal: not a git repository'));
      }
    );

    await expect(currentGitBranch('/tmp')).resolves.toBeUndefined();
  });
});
