// eslint-disable-next-line depend/ban-dependencies
import { execa, type ExecaError } from 'execa';

import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors';

export interface GitDiffResult {
  changed: Set<string>;
  new: Set<string>;
}

function parseChangedFiles(stdout: string): Set<string> {
  return new Set(
    stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

export class GitDiffProvider {
  private repoRoot: string | undefined;

  constructor(private readonly cwd = process.cwd()) {}

  async getRepoRoot(): Promise<string> {
    if (this.repoRoot) {
      return this.repoRoot;
    }

    try {
      const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], {
        cwd: this.cwd,
        stdio: 'pipe',
      });

      this.repoRoot = stdout.trim();
      return this.repoRoot;
    } catch (error) {
      throw this.toGitError(error, 'git rev-parse --show-toplevel');
    }
  }

  async getChangedFiles(): Promise<GitDiffResult> {
    const repoRoot = await this.getRepoRoot();

    try {
      const [staged, unstaged, untracked] = await Promise.all([
        execa('git', ['diff', '--name-only', '--diff-filter=d', '--cached'], {
          cwd: repoRoot,
          stdio: 'pipe',
        }),
        execa('git', ['diff', '--name-only', '--diff-filter=d'], {
          cwd: repoRoot,
          stdio: 'pipe',
        }),
        execa('git', ['ls-files', '--others', '--exclude-standard'], {
          cwd: repoRoot,
          stdio: 'pipe',
        }),
      ]);

      return {
        changed: new Set([
          ...parseChangedFiles(staged.stdout),
          ...parseChangedFiles(unstaged.stdout),
        ]),
        new: parseChangedFiles(untracked.stdout),
      };
    } catch (error) {
      throw this.toGitError(error, 'git diff');
    }
  }

  private toGitError(error: unknown, command: string): Error {
    const execaError = error as Partial<ExecaError>;
    const stderr = [execaError.stderr, execaError.shortMessage, execaError.message]
      .filter(Boolean)
      .join('\n');

    if (execaError.code === 'ENOENT') {
      return new ChangeDetectionUnavailableError('git is not available', { cause: error as Error });
    }

    if (stderr.includes('not a git repository')) {
      return new ChangeDetectionUnavailableError('not a git repository', {
        cause: error as Error,
      });
    }

    return new ChangeDetectionFailureError(`${command} failed${stderr ? `: ${stderr}` : ''}`, {
      cause: error as Error,
    });
  }
}
