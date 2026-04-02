import { watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { execa, type ExecaError } from 'execa';
import { logger } from 'storybook/internal/node-logger';

import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors';

export interface GitDiffResult {
  changed: Set<string>;
  new: Set<string>;
}

type GitStateChangeCallback = () => void;
type WatcherKey = 'branch' | 'head' | 'packedRefs';
type GitFileSystem = {
  watch: typeof watch;
  readFile: typeof readFile;
  stat: typeof stat;
};

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
  private gitStateCallback: GitStateChangeCallback | undefined;
  private readonly watchers: Partial<Record<WatcherKey, FSWatcher>> = {};

  constructor(
    private readonly cwd = process.cwd(),
    private readonly fileSystem: GitFileSystem = { watch, readFile, stat }
  ) {}

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
    const runGitCommand = async (args: string[]) => {
      try {
        return await execa('git', args, { cwd: repoRoot, stdio: 'pipe' });
      } catch (error) {
        throw this.toGitError(error, `git ${args.join(' ')}`);
      }
    };

    const [staged, unstaged, added, intentToAdd, untracked] = await Promise.all([
      runGitCommand(['diff', '--name-only', '--diff-filter=ad', '--cached']),
      runGitCommand(['diff', '--name-only', '--diff-filter=ad']),
      runGitCommand(['diff', '--name-only', '--diff-filter=A', '--cached']),
      runGitCommand(['diff', '--name-only', '--diff-filter=A']),
      runGitCommand(['ls-files', '--others', '--exclude-standard']),
    ]);

    return {
      changed: new Set([
        ...parseChangedFiles(staged.stdout),
        ...parseChangedFiles(unstaged.stdout),
      ]),
      new: new Set([
        ...parseChangedFiles(added.stdout),
        ...parseChangedFiles(intentToAdd.stdout),
        ...parseChangedFiles(untracked.stdout),
      ]),
    };
  }

  onGitStateChange(callback: GitStateChangeCallback): () => void {
    // We intentionally support only one subscriber: change detection currently has a single consumer,
    // so we keep lifecycle management simple instead of multiplexing callbacks.
    this.gitStateCallback = callback;
    this.clearAllWatchers();
    void this.setupWatchers();

    return () => {
      if (this.gitStateCallback === callback) {
        this.gitStateCallback = undefined;
        this.clearAllWatchers();
      }
    };
  }

  private async setupWatchers(): Promise<void> {
    if (!this.gitStateCallback) {
      return;
    }

    try {
      const gitDir = await this.getGitDir();
      this.watchFile('head', gitDir, () => {
        this.emitGitStateChange();
        this.reconfigureBranchWatcher(gitDir);
      });
      this.watchFile('packedRefs', gitDir, () => {
        this.emitGitStateChange();
      });
      await this.configureBranchWatcher(gitDir);
    } catch {
      // Watching git state is opportunistic; scanning still runs from module graph updates.
    }
  }

  private emitGitStateChange(): void {
    this.gitStateCallback?.();
  }

  private watchFile(
    key: WatcherKey,
    filePath: string,
    onChange: GitStateChangeCallback
  ): FSWatcher | undefined {
    if (!this.gitStateCallback) {
      return undefined;
    }

    try {
      const watcher = this.fileSystem.watch(filePath, { persistent: false }, () => {
        if (this.gitStateCallback) {
          onChange();
        }
      });

      if (!this.gitStateCallback) {
        watcher.close();
        return undefined;
      }

      watcher.on('error', () => {
        watcher.close();
        if (this.watchers[key] === watcher) {
          delete this.watchers[key];
        }
        // Intentionally do not rebuild watchers after runtime failures. Module-graph events still
        // drive scans, and avoiding auto-recovery keeps this code path small and predictable.
        this.clearAllWatchers();
        logger.warn(
          `Change detection git watcher failed for ${filePath}. Git state updates may stop until restart.`
        );
      });

      this.clearWatcher(key);
      this.watchers[key] = watcher;
      return watcher;
    } catch (error) {
      if (this.isEnoentError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  private async configureBranchWatcher(gitDir: string): Promise<void> {
    if (!this.gitStateCallback) {
      return;
    }

    const branchRef = await this.readHeadRef(gitDir);

    if (!this.gitStateCallback) {
      return;
    }

    this.clearWatcher('branch');

    if (branchRef?.startsWith('refs/heads/')) {
      const branchRefPath = join(gitDir, branchRef);
      const branchWatcher = this.watchFile('branch', dirname(branchRefPath), () => {
        this.emitGitStateChange();
        this.reconfigureBranchWatcher(gitDir);
      });

      if (!branchWatcher) {
        this.watchFile('branch', join(gitDir, 'refs', 'heads'), () => {
          this.emitGitStateChange();
          this.reconfigureBranchWatcher(gitDir);
        });
      }
    }
  }

  private reconfigureBranchWatcher(gitDir: string): void {
    void this.configureBranchWatcher(gitDir).catch(() => {
      // Same trade-off as watcher errors: fail closed and warn instead of retrying/rebuilding.
      logger.warn('Change detection failed to reconfigure git branch watcher.');
      this.clearAllWatchers();
    });
  }

  private clearWatcher(key: WatcherKey): void {
    this.watchers[key]?.close();
    delete this.watchers[key];
  }

  private clearAllWatchers(): void {
    (Object.keys(this.watchers) as WatcherKey[]).forEach((key) => {
      this.clearWatcher(key);
    });
  }

  private async getGitDir(): Promise<string> {
    const repoRoot = await this.getRepoRoot();
    const gitPath = join(repoRoot, '.git');

    try {
      const gitStat = await this.fileSystem.stat(gitPath);
      if (gitStat.isDirectory()) {
        return gitPath;
      }

      if (gitStat.isFile()) {
        const gitPointer = await this.fileSystem.readFile(gitPath, 'utf8');
        const match = /^gitdir:\s+(.+)$/m.exec(gitPointer.trim());

        if (match) {
          return resolvePath(repoRoot, match[1]);
        }
      }
    } catch (error) {
      if (!this.isEnoentError(error)) {
        throw error;
      }
    }

    return gitPath;
  }

  private async readHeadRef(gitDir: string): Promise<string | undefined> {
    try {
      const headContents = await this.fileSystem.readFile(join(gitDir, 'HEAD'), 'utf8');
      const match = /^ref:\s+(.+)$/m.exec(headContents.trim());
      return match?.[1];
    } catch (error) {
      if (!this.isEnoentError(error)) {
        throw error;
      }
    }
  }

  private isEnoentError(error: unknown): error is NodeJS.ErrnoException {
    return Boolean(
      error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
    );
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
