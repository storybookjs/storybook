import { watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { execa, type ExecaError } from 'execa';

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
  private readonly gitStateCallbacks = new Set<GitStateChangeCallback>();
  private readonly watchers: Partial<Record<WatcherKey, FSWatcher>> = {};
  private watcherSetupInFlight: Promise<void> | undefined;
  private watcherSetupGeneration = 0;

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

    const [staged, unstaged, untracked, stagedAdded] = await Promise.all([
      runGitCommand(['diff', '--name-only', '--diff-filter=d', '--cached']),
      runGitCommand(['diff', '--name-only', '--diff-filter=d']),
      runGitCommand(['ls-files', '--others', '--exclude-standard']),
      runGitCommand(['diff', '--name-only', '--diff-filter=A', '--cached']),
    ]);

    return {
      changed: new Set([
        ...parseChangedFiles(staged.stdout),
        ...parseChangedFiles(unstaged.stdout),
      ]),
      new: new Set([
        ...parseChangedFiles(untracked.stdout),
        ...parseChangedFiles(stagedAdded.stdout),
      ]),
    };
  }

  onGitStateChange(callback: GitStateChangeCallback): () => void {
    this.gitStateCallbacks.add(callback);
    void this.ensureWatchers();

    return () => {
      this.gitStateCallbacks.delete(callback);

      if (this.gitStateCallbacks.size === 0) {
        this.watcherSetupGeneration += 1;
        this.clearAllWatchers();
      }
    };
  }

  private async ensureWatchers(): Promise<void> {
    while (this.gitStateCallbacks.size > 0 && Object.keys(this.watchers).length === 0) {
      if (!this.watcherSetupInFlight) {
        this.watcherSetupInFlight = this.setupWatchers(this.watcherSetupGeneration);
      }

      await this.watcherSetupInFlight;
    }
  }

  private async setupWatchers(generation: number): Promise<void> {
    try {
      const gitDir = await this.getGitDir();

      if (!this.isWatcherSetupCurrent(generation)) {
        return;
      }

      this.watchFile(generation, 'head', join(gitDir, 'HEAD'), () => {
        this.emitGitStateChange();
        void this.configureBranchWatcher(gitDir, generation);
      });
      this.watchFile(generation, 'packedRefs', join(gitDir, 'packed-refs'), () => {
        this.emitGitStateChange();
      });
      await this.configureBranchWatcher(gitDir, generation);
    } catch {
      // Watching git state is opportunistic; scanning still runs from module graph updates.
    } finally {
      this.watcherSetupInFlight = undefined;
    }
  }

  private emitGitStateChange(): void {
    this.gitStateCallbacks.forEach((registeredCallback) => {
      registeredCallback();
    });
  }

  private watchFile(
    generation: number,
    key: WatcherKey,
    filePath: string,
    onChange: GitStateChangeCallback
  ): FSWatcher | undefined {
    if (!this.isWatcherSetupCurrent(generation)) {
      return undefined;
    }

    try {
      const watcher = this.fileSystem.watch(filePath, { persistent: false }, () => {
        if (this.isWatcherSetupCurrent(generation)) {
          onChange();
        }
      });

      if (!this.isWatcherSetupCurrent(generation)) {
        watcher.close();
        return undefined;
      }

      watcher.on('error', () => {
        watcher.close();
        if (this.watchers[key] === watcher) {
          delete this.watchers[key];
        }
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

  private async configureBranchWatcher(gitDir: string, generation: number): Promise<void> {
    if (!this.isWatcherSetupCurrent(generation)) {
      return;
    }

    const branchRef = await this.readHeadRef(gitDir);

    if (!this.isWatcherSetupCurrent(generation)) {
      return;
    }

    this.clearWatcher('branch');

    if (branchRef?.startsWith('refs/heads/')) {
      const branchWatcher = this.watchFile(generation, 'branch', join(gitDir, branchRef), () => {
        this.emitGitStateChange();
      });

      if (!branchWatcher) {
        this.watchFile(generation, 'branch', join(gitDir, 'refs', 'heads'), () => {
          this.emitGitStateChange();
          void this.configureBranchWatcher(gitDir, generation);
        });
      }
    }
  }

  private isWatcherSetupCurrent(generation: number): boolean {
    return this.gitStateCallbacks.size > 0 && generation === this.watcherSetupGeneration;
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
