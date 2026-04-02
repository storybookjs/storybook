import type { FSWatcher } from 'node:fs';
import type { readFile, stat } from 'node:fs/promises';
import type { watch } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';
import { logger } from 'storybook/internal/node-logger';

import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors.ts';
import { GitDiffProvider } from './GitDiffProvider.ts';

vi.mock('execa', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

type ExecaMockResult = { stdout: string } | { error: Error };
type MockWatcherRecord = {
  path: string;
  watcher: FSWatcher;
  emitChange: () => void;
  emitError: () => void;
};
type GitDiffProviderTestContext = {
  headReads: string[];
  watchRecords: MockWatcherRecord[];
  mockReadFile: ReturnType<typeof vi.fn>;
  createProvider: () => GitDiffProvider;
  getWatchedPaths: () => string[];
};
type SetupGitWatchProviderOptions = {
  gitDirFileContents?: string;
  headReadDelay?: Promise<unknown>;
  missingWatchPaths?: string[];
};

function mockStats(isDirectory: boolean) {
  return {
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
  } as Awaited<ReturnType<typeof stat>>;
}

function resolved(stdout: string): ExecaMockResult {
  return { stdout };
}

function rejected(error: Error): ExecaMockResult {
  return { error };
}

function setupGitWatchProvider(
  options: SetupGitWatchProviderOptions = {}
): GitDiffProviderTestContext {
  const watchRecords: MockWatcherRecord[] = [];
  const headReads: string[] = ['ref: refs/heads/main\n'];
  const gitDirPath = options.gitDirFileContents ? '/actual/git-dir' : '/repo/.git';
  const missingWatchPaths = new Set(options.missingWatchPaths ?? []);
  const mockWatch = ((path, _options, listener) => {
    let onError: (() => void) | undefined;
    if (missingWatchPaths.has(String(path))) {
      throw Object.assign(new Error(`Missing watch path: ${String(path)}`), { code: 'ENOENT' });
    }

    const watcher = {
      close: vi.fn(),
      on: vi.fn().mockImplementation((event: string, handler: () => void) => {
        if (event === 'error') {
          onError = handler;
        }
        return watcher;
      }),
    } as unknown as FSWatcher;

    watchRecords.push({
      path: String(path),
      watcher,
      emitChange: () => {
        listener?.('change', null);
      },
      emitError: () => {
        onError?.();
      },
    });

    return watcher;
  }) as typeof watch;
  const mockReadFile = vi.fn(async (path) => {
    if (String(path) === '/repo/.git' && options.gitDirFileContents) {
      return options.gitDirFileContents;
    }

    if (String(path) === `${gitDirPath}/HEAD`) {
      await options.headReadDelay;
      return headReads.shift() ?? headReads[0] ?? 'ref: refs/heads/main\n';
    }

    throw Object.assign(new Error(`Unexpected read: ${String(path)}`), { code: 'ENOENT' });
  }) as unknown as typeof readFile;
  const mockStat = vi.fn(async (path) => {
    if (String(path) === '/repo/.git') {
      return mockStats(!options.gitDirFileContents);
    }

    throw Object.assign(new Error(`Unexpected stat: ${String(path)}`), { code: 'ENOENT' });
  }) as unknown as typeof stat;

  return {
    headReads,
    watchRecords,
    mockReadFile: mockReadFile as ReturnType<typeof vi.fn>,
    createProvider: () =>
      new GitDiffProvider('/repo', {
        watch: mockWatch,
        readFile: mockReadFile,
        stat: mockStat,
      }),
    getWatchedPaths: () => watchRecords.map(({ path }) => path),
  };
}

describe('GitDiffProvider', () => {
  let repoRootResult: ExecaMockResult;
  let stagedResult: ExecaMockResult;
  let unstagedResult: ExecaMockResult;
  let untrackedResult: ExecaMockResult;
  let stagedAddedResult: ExecaMockResult;
  let intentToAddResult: ExecaMockResult;

  beforeEach(() => {
    vi.clearAllMocks();
    repoRootResult = resolved('/repo');
    stagedResult = resolved('src/Button.tsx\n');
    unstagedResult = resolved('src/Button.tsx\n');
    untrackedResult = resolved('src/Button.css\n');
    stagedAddedResult = resolved('src/NewButton.stories.tsx\n');
    intentToAddResult = resolved('');

    vi.mocked(execa).mockImplementation(((_command: string | URL, ...rest: unknown[]) => {
      const args = Array.isArray(rest[0]) ? rest[0] : [];
      const gitArgs = args.join(' ');
      const result =
        gitArgs === 'rev-parse --show-toplevel'
          ? repoRootResult
          : gitArgs === 'diff --name-only --diff-filter=ad --cached'
            ? stagedResult
            : gitArgs === 'diff --name-only --diff-filter=ad'
              ? unstagedResult
              : gitArgs === 'ls-files --others --exclude-standard'
                ? untrackedResult
                : gitArgs === 'diff --name-only --diff-filter=A --cached'
                  ? stagedAddedResult
                  : gitArgs === 'diff --name-only --diff-filter=A'
                    ? intentToAddResult
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

  it('returns changed and new files without overlap', async () => {
    const provider = new GitDiffProvider('/repo');

    await expect(provider.getChangedFiles()).resolves.toEqual({
      changed: new Set(['src/Button.tsx']),
      new: new Set(['src/Button.css', 'src/NewButton.stories.tsx']),
    });
  });

  it('includes intent-to-add files in new', async () => {
    intentToAddResult = resolved('src/IntentToAdd.ts\n');
    const provider = new GitDiffProvider('/repo');

    await expect(provider.getChangedFiles()).resolves.toEqual({
      changed: new Set(['src/Button.tsx']),
      new: new Set(['src/Button.css', 'src/NewButton.stories.tsx', 'src/IntentToAdd.ts']),
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
        message: expect.stringContaining('git diff --name-only --diff-filter=ad --cached failed'),
      })
    );
    await expect(provider.getChangedFiles()).rejects.toBeInstanceOf(ChangeDetectionFailureError);
  });

  it('watches git and branch directories for git state changes', async () => {
    const { createProvider, getWatchedPaths, watchRecords } = setupGitWatchProvider();
    const onGitStateChange = vi.fn();
    const provider = createProvider();

    provider.onGitStateChange(onGitStateChange);
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toEqual(['/repo/.git', '/repo/.git', '/repo/.git/refs/heads']);
    });

    watchRecords[2].emitChange();
    watchRecords[1].emitChange();

    expect(onGitStateChange).toHaveBeenCalledTimes(2);
  });

  it('reconfigures the branch watcher when HEAD changes', async () => {
    const { createProvider, getWatchedPaths, headReads, watchRecords } = setupGitWatchProvider();
    headReads.splice(
      0,
      headReads.length,
      'ref: refs/heads/main\n',
      'ref: refs/heads/releases/main\n'
    );
    const onGitStateChange = vi.fn();
    const provider = createProvider();

    provider.onGitStateChange(onGitStateChange);
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toContain('/repo/.git/refs/heads');
    });

    const mainBranchWatcher = watchRecords.find(
      ({ path }) => path === '/repo/.git/refs/heads'
    )?.watcher;
    expect(mainBranchWatcher).toBeDefined();
    if (!mainBranchWatcher) {
      throw new Error('Expected main branch watcher to be registered');
    }

    watchRecords[0].emitChange();
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toContain('/repo/.git/refs/heads/releases');
    });

    expect(onGitStateChange).toHaveBeenCalledTimes(1);
    expect(mainBranchWatcher.close).toHaveBeenCalledTimes(1);

    watchRecords.at(-1)?.emitChange();

    expect(onGitStateChange).toHaveBeenCalledTimes(2);
  });

  it('resolves gitdir pointers for worktrees', async () => {
    const { createProvider, getWatchedPaths } = setupGitWatchProvider({
      gitDirFileContents: 'gitdir: ../actual/git-dir\n',
    });
    const provider = createProvider();

    provider.onGitStateChange(vi.fn());
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toEqual([
        '/actual/git-dir',
        '/actual/git-dir',
        '/actual/git-dir/refs/heads',
      ]);
    });
  });

  it('falls back to watching refs/heads when the branch directory is missing', async () => {
    const { createProvider, getWatchedPaths, headReads, watchRecords } = setupGitWatchProvider({
      missingWatchPaths: ['/repo/.git/refs/heads/feature'],
    });
    headReads.splice(
      0,
      headReads.length,
      'ref: refs/heads/feature/release\n',
      'ref: refs/heads/feature/release\n'
    );
    const onGitStateChange = vi.fn();
    const provider = createProvider();

    provider.onGitStateChange(onGitStateChange);
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toEqual(['/repo/.git', '/repo/.git', '/repo/.git/refs/heads']);
    });

    watchRecords[2].emitChange();

    expect(onGitStateChange).toHaveBeenCalledTimes(1);
  });

  it('cleans up all git watchers when the last callback unsubscribes', async () => {
    const { createProvider, watchRecords } = setupGitWatchProvider();
    const onGitStateChange = vi.fn();
    const provider = createProvider();

    const unsubscribe = provider.onGitStateChange(onGitStateChange);
    await vi.waitFor(() => {
      expect(watchRecords).toHaveLength(3);
    });

    unsubscribe();
    watchRecords.forEach(({ emitChange }) => {
      emitChange();
    });

    expect(onGitStateChange).not.toHaveBeenCalled();
    watchRecords.forEach(({ watcher }) => {
      expect(watcher.close).toHaveBeenCalledTimes(1);
    });
  });

  it('replaces existing git watchers when subscribing a new callback', async () => {
    const { createProvider, watchRecords } = setupGitWatchProvider();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const provider = createProvider();

    provider.onGitStateChange(firstCallback);
    await vi.waitFor(() => {
      expect(watchRecords).toHaveLength(3);
    });

    const initialWatchers = watchRecords.map(({ watcher }) => watcher);

    provider.onGitStateChange(secondCallback);
    await vi.waitFor(() => {
      expect(watchRecords).toHaveLength(6);
    });

    watchRecords[1].emitChange();
    watchRecords[4].emitChange();

    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(2);
    initialWatchers.forEach((watcher) => {
      expect(watcher.close).toHaveBeenCalledTimes(1);
    });
  });

  it('does not retry watcher setup indefinitely when no watchers can be installed', async () => {
    // This codifies our simplified behavior: setup is best-effort and we intentionally avoid
    // background retry loops when git watching is unavailable.
    repoRootResult = rejected(new Error('fatal: not a git repository'));
    const provider = new GitDiffProvider('/repo');

    provider.onGitStateChange(vi.fn());
    await vi.waitFor(() => {
      expect(vi.mocked(execa)).toHaveBeenCalledTimes(1);
    });
  });

  it('logs a warning and tears down watchers when a watcher errors', async () => {
    const { createProvider, watchRecords } = setupGitWatchProvider();
    const provider = createProvider();

    provider.onGitStateChange(vi.fn());
    await vi.waitFor(() => {
      expect(watchRecords).toHaveLength(3);
    });

    watchRecords[1].emitError();

    watchRecords.slice(0, 3).forEach(({ watcher }) => {
      expect(watcher.close).toHaveBeenCalledTimes(1);
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detection git watcher failed')
    );
  });
});
