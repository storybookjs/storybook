import { watch, type FSWatcher } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve as resolvePath } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { execa, type ExecaError } from 'execa';
import { logger } from 'storybook/internal/node-logger';

import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';

export interface GitDiffResult {
  changed: Set<string>;
  new: Set<string>;
}

type GitStateChangeCallback = () => void;
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
  private gitStateCallback: GitStateChangeCallback = () => {};
  private branchWatcher: FSWatcher | undefined;
  private headWatcher: FSWatcher | undefined;
  private packedRefsWatcher: FSWatcher | undefined;
  private watchingInitialized = false;
  private watchingStopped = false;

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
    const runGitCommand = (args: string[]) => this.runGitCommand(repoRoot, args);

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

  async getHeadCommit(): Promise<string> {
    const repoRoot = await this.getRepoRoot();
    const { stdout } = await this.runGitCommand(repoRoot, ['rev-parse', 'HEAD']);
    return stdout.trim();
  }

  async isWorkingTreeClean(): Promise<boolean> {
    const repoRoot = await this.getRepoRoot();
    const { stdout } = await this.runGitCommand(repoRoot, ['status', '--porcelain']);
    return stdout.trim().length === 0;
  }

  onGitStateChange(callback: GitStateChangeCallback): void {
    // Change detection has a single long-lived consumer.
    this.gitStateCallback = callback;
    if (!this.watchingInitialized && !this.watchingStopped) {
      this.watchingInitialized = true;
      void this.initializeWatching();
    }
  }

  private async initializeWatching(): Promise<void> {
    try {
      const gitDir = await this.getGitDir();
      this.headWatcher = this.attachWatcher({
        filePath: gitDir,
        currentWatcher: this.headWatcher,
        onChange: () => {
          this.gitStateCallback();
          this.reconfigureBranchWatcher(gitDir);
        },
      });
      this.packedRefsWatcher = this.attachWatcher({
        filePath: gitDir,
        currentWatcher: this.packedRefsWatcher,
        onChange: () => {
          this.gitStateCallback();
        },
      });
      await this.configureBranchWatcher(gitDir);
    } catch {
      // Watching git state is opportunistic; scanning still runs from module graph updates.
    }
  }

  private attachWatcher(options: {
    filePath: string;
    currentWatcher: FSWatcher | undefined;
    onChange: () => void;
  }): FSWatcher | undefined {
    const { filePath, currentWatcher, onChange } = options;
    if (this.watchingStopped) {
      return undefined;
    }

    try {
      const watcher = this.fileSystem.watch(filePath, { persistent: false }, () => {
        if (!this.watchingStopped) {
          onChange();
        }
      });

      currentWatcher?.close();

      watcher.on('error', () => {
        watcher.close();
        if (this.headWatcher === watcher) {
          this.headWatcher = undefined;
        }
        if (this.packedRefsWatcher === watcher) {
          this.packedRefsWatcher = undefined;
        }
        if (this.branchWatcher === watcher) {
          this.branchWatcher = undefined;
        }
        this.stopWatching();
        logger.warn(
          `Change detection git watcher failed for ${filePath}. Git state updates may stop until restart.`
        );
      });

      return watcher;
    } catch (error) {
      if (this.isEnoentError(error)) {
        return undefined;
      }

      throw error;
    }
  }

  private async configureBranchWatcher(gitDir: string): Promise<void> {
    const branchRef = await this.readHeadRef(gitDir);

    this.branchWatcher?.close();
    this.branchWatcher = undefined;

    const watchBranch = (filePath: string): FSWatcher | undefined => {
      this.branchWatcher = this.attachWatcher({
        filePath,
        currentWatcher: this.branchWatcher,
        onChange: () => {
          this.gitStateCallback();
          this.reconfigureBranchWatcher(gitDir);
        },
      });
      return this.branchWatcher;
    };

    if (branchRef?.startsWith('refs/heads/')) {
      const refWatcher = watchBranch(dirname(join(gitDir, branchRef)));
      if (!refWatcher) {
        watchBranch(join(gitDir, 'refs', 'heads'));
      }
    }
  }

  private reconfigureBranchWatcher(gitDir: string): void {
    void this.configureBranchWatcher(gitDir).catch(() => {
      // Same trade-off as watcher errors: fail closed and warn instead of retrying/rebuilding.
      logger.warn('Change detection failed to reconfigure git branch watcher.');
      this.stopWatching();
    });
  }

  private stopWatching(): void {
    if (this.watchingStopped) {
      return;
    }

    this.watchingStopped = true;
    this.headWatcher?.close();
    this.headWatcher = undefined;
    this.packedRefsWatcher?.close();
    this.packedRefsWatcher = undefined;
    this.branchWatcher?.close();
    this.branchWatcher = undefined;
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

  private async runGitCommand(repoRoot: string, args: string[]) {
    try {
      return await execa('git', args, { cwd: repoRoot, stdio: 'pipe' });
    } catch (error) {
      throw this.toGitError(error, `git ${args.join(' ')}`);
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
