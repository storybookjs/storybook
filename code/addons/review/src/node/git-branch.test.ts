import { execFile } from 'node:child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentGitBranch } from './git-branch.ts';

// `git-branch.ts` wraps execFile with `promisify` at module load. A plain
// `{ spy: true }` mock keeps execFile's `util.promisify.custom` symbol, which
// makes `promisify` bypass the spy and run real git. Re-exporting it as a fresh
// spy drops that symbol so `promisify` falls back to the callback path we mock.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFile: vi.fn(actual.execFile) };
});

type ExecFileCallback = (error: Error | null, result?: { stdout: string }) => void;

const mockedExecFile = vi.mocked(execFile);

describe('currentGitBranch', () => {
  beforeEach(() => {
    mockedExecFile.mockReset();
  });

  describe('in a git repo', () => {
    beforeEach(() => {
      mockedExecFile.mockImplementation(((
        _file: string,
        _args: string[],
        _options: { cwd: string },
        callback: ExecFileCallback
      ) => {
        callback(null, { stdout: 'feature/review-state\n' });
      }) as unknown as typeof execFile);
    });

    it('returns the current branch name', async () => {
      await expect(currentGitBranch('/repo')).resolves.toBe('feature/review-state');
      expect(mockedExecFile).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: '/repo' },
        expect.any(Function)
      );
    });
  });

  describe('on a detached HEAD', () => {
    beforeEach(() => {
      mockedExecFile.mockImplementation(((
        _file: string,
        _args: string[],
        _options: { cwd: string },
        callback: ExecFileCallback
      ) => {
        callback(null, { stdout: 'HEAD\n' });
      }) as unknown as typeof execFile);
    });

    it('returns undefined', async () => {
      await expect(currentGitBranch('/repo')).resolves.toBeUndefined();
    });
  });

  describe('when the git command fails (e.g. non-git directory)', () => {
    beforeEach(() => {
      mockedExecFile.mockImplementation(((
        _file: string,
        _args: string[],
        _options: { cwd: string },
        callback: ExecFileCallback
      ) => {
        callback(new Error('fatal: not a git repository'));
      }) as unknown as typeof execFile);
    });

    it('returns undefined', async () => {
      await expect(currentGitBranch('/tmp')).resolves.toBeUndefined();
    });
  });
});
