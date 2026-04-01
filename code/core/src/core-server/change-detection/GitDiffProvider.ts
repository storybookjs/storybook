import { watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';

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
  private watcherRebuildTimer: ReturnType<typeof setTimeout> | undefined;
  private watcherRebuildAttempts = 0;

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
    this.gitStateCallbacks.add(callback);
    void this.ensureWatchers();

    return () => {
      this.gitStateCallbacks.delete(callback);

      if (this.gitStateCallbacks.size === 0) {
        this.cancelWatcherRebuild();
        this.invalidateAndClearWatchers();
      }
    };
  }

  private async ensureWatchers(): Promise<void> {
    if (this.gitStateCallbacks.size === 0 || Object.keys(this.watchers).length > 0) {
      return;
    }

    if (!this.watcherSetupInFlight) {
      this.watcherSetupInFlight = this.setupWatchers(this.watcherSetupGeneration);
    }

    await this.watcherSetupInFlight;
  }

  private async setupWatchers(generation: number): Promise<void> {
    try {
      const gitDir = await this.getGitDir();

      if (!this.isWatcherSetupCurrent(generation)) {
        return;
      }

      this.watchFile(generation, 'head', gitDir, () => {
        this.emitGitStateChange();
        this.reconfigureBranchWatcher(gitDir, generation);
      });
      this.watchFile(generation, 'packedRefs', gitDir, () => {
        this.emitGitStateChange();
      });
      await this.configureBranchWatcher(gitDir, generation);
      this.watcherRebuildAttempts = 0;
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
        if (this.isWatcherSetupCurrent(generation)) {
          this.scheduleWatcherRebuild();
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
      const branchRefPath = join(gitDir, branchRef);
      const branchWatcher = this.watchFile(generation, 'branch', dirname(branchRefPath), () => {
        this.emitGitStateChange();
        this.reconfigureBranchWatcher(gitDir, generation);
      });

      if (!branchWatcher) {
        this.watchFile(generation, 'branch', join(gitDir, 'refs', 'heads'), () => {
          this.emitGitStateChange();
          this.reconfigureBranchWatcher(gitDir, generation);
        });
      }
    }
  }

  private reconfigureBranchWatcher(gitDir: string, generation: number): void {
    void this.configureBranchWatcher(gitDir, generation).catch(() => {
      if (this.isWatcherSetupCurrent(generation)) {
        this.scheduleWatcherRebuild();
      }
    });
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

  private invalidateAndClearWatchers(): void {
    this.watcherSetupGeneration += 1;
    this.clearAllWatchers();
  }

  private scheduleWatcherRebuild(): void {
    if (this.watcherRebuildTimer || this.gitStateCallbacks.size === 0) {
      return;
    }

    const delayMs = Math.min(1000, 50 * 2 ** this.watcherRebuildAttempts);
    this.watcherRebuildAttempts += 1;

    this.watcherRebuildTimer = setTimeout(() => {
      this.watcherRebuildTimer = undefined;
      if (this.gitStateCallbacks.size === 0) {
        return;
      }

      this.invalidateAndClearWatchers();
      void this.ensureWatchers();
    }, delayMs);
  }

  private cancelWatcherRebuild(): void {
    if (this.watcherRebuildTimer) {
      clearTimeout(this.watcherRebuildTimer);
      this.watcherRebuildTimer = undefined;
    }
    this.watcherRebuildAttempts = 0;
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
