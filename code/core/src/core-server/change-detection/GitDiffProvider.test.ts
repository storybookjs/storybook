import type { FSWatcher } from 'node:fs';
import type { readFile, stat } from 'node:fs/promises';
import type { watch } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

import { ChangeDetectionFailureError, ChangeDetectionUnavailableError } from './errors';
import { GitDiffProvider } from './GitDiffProvider';

vi.mock('execa', { spy: true });

type ExecaMockResult = { stdout: string } | { error: Error };
type MockWatcherRecord = {
  path: string;
  watcher: FSWatcher;
  emitChange: () => void;
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  return {
    promise: new Promise<T>((fulfill) => {
      resolve = fulfill;
    }),
    resolve,
  };
}

function setupGitWatchProvider(
  options: SetupGitWatchProviderOptions = {}
): GitDiffProviderTestContext {
  const watchRecords: MockWatcherRecord[] = [];
  const headReads: string[] = ['ref: refs/heads/main\n'];
  const gitDirPath = options.gitDirFileContents ? '/actual/git-dir' : '/repo/.git';
  const missingWatchPaths = new Set(options.missingWatchPaths ?? []);
  const mockWatch = ((path, _options, listener) => {
    if (missingWatchPaths.has(String(path))) {
      throw Object.assign(new Error(`Missing watch path: ${String(path)}`), { code: 'ENOENT' });
    }

    const watcher = {
      close: vi.fn(),
      on: vi.fn().mockReturnThis(),
    } as unknown as FSWatcher;

    watchRecords.push({
      path: String(path),
      watcher,
      emitChange: () => {
        listener?.('change', null);
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

  it('watches HEAD, packed-refs, and the current branch ref for git state changes', async () => {
    const { createProvider, getWatchedPaths, watchRecords } = setupGitWatchProvider();
    const onGitStateChange = vi.fn();
    const provider = createProvider();

    provider.onGitStateChange(onGitStateChange);
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toEqual([
        '/repo/.git/HEAD',
        '/repo/.git/packed-refs',
        '/repo/.git/refs/heads/main',
      ]);
    });

    watchRecords[2].emitChange();
    watchRecords[1].emitChange();

    expect(onGitStateChange).toHaveBeenCalledTimes(2);
  });

  it('reconfigures the branch watcher when HEAD changes', async () => {
    const { createProvider, getWatchedPaths, headReads, watchRecords } = setupGitWatchProvider();
    headReads.splice(0, headReads.length, 'ref: refs/heads/main\n', 'ref: refs/heads/release\n');
    const onGitStateChange = vi.fn();
    const provider = createProvider();

    provider.onGitStateChange(onGitStateChange);
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toContain('/repo/.git/refs/heads/main');
    });

    const mainBranchWatcher = watchRecords.find(
      ({ path }) => path === '/repo/.git/refs/heads/main'
    )?.watcher;
    expect(mainBranchWatcher).toBeDefined();
    if (!mainBranchWatcher) {
      throw new Error('Expected main branch watcher to be registered');
    }

    watchRecords[0].emitChange();
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toContain('/repo/.git/refs/heads/release');
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
        '/actual/git-dir/HEAD',
        '/actual/git-dir/packed-refs',
        '/actual/git-dir/refs/heads/main',
      ]);
    });
  });

  it('falls back to watching refs/heads when the branch ref file is missing', async () => {
    const { createProvider, getWatchedPaths, headReads, watchRecords } = setupGitWatchProvider({
      missingWatchPaths: ['/repo/.git/refs/heads/release'],
    });
    headReads.splice(0, headReads.length, 'ref: refs/heads/release\n', 'ref: refs/heads/release\n');
    const onGitStateChange = vi.fn();
    const provider = createProvider();

    provider.onGitStateChange(onGitStateChange);
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toEqual([
        '/repo/.git/HEAD',
        '/repo/.git/packed-refs',
        '/repo/.git/refs/heads',
      ]);
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

  it('reuses the same git watchers for multiple callbacks', async () => {
    const { createProvider, watchRecords } = setupGitWatchProvider();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const provider = createProvider();

    const unsubscribeFirst = provider.onGitStateChange(firstCallback);
    await vi.waitFor(() => {
      expect(watchRecords).toHaveLength(3);
    });

    const initialWatchers = watchRecords.map(({ watcher }) => watcher);

    const unsubscribeSecond = provider.onGitStateChange(secondCallback);
    await Promise.resolve();

    expect(watchRecords).toHaveLength(3);
    expect(watchRecords.map(({ watcher }) => watcher)).toEqual(initialWatchers);

    watchRecords[1].emitChange();

    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    initialWatchers.forEach((watcher) => {
      expect(watcher.close).not.toHaveBeenCalled();
    });

    unsubscribeSecond();
    initialWatchers.forEach((watcher) => {
      expect(watcher.close).toHaveBeenCalledTimes(1);
    });
  });

  it('does not leave watchers behind when unsubscribing during setup', async () => {
    const headReadDeferred = createDeferred<void>();
    const { createProvider, getWatchedPaths } = setupGitWatchProvider({
      headReadDelay: headReadDeferred.promise,
    });
    const provider = createProvider();

    const unsubscribe = provider.onGitStateChange(vi.fn());
    await vi.waitFor(() => {
      expect(getWatchedPaths()).toEqual(['/repo/.git/HEAD', '/repo/.git/packed-refs']);
    });

    unsubscribe();
    headReadDeferred.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(getWatchedPaths()).toEqual(['/repo/.git/HEAD', '/repo/.git/packed-refs']);
  });
});
