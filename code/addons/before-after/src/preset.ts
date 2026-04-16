import { watch, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { EVENTS } from './constants.ts';
import { invalidateCache } from './node/git-file-at-head.ts';
import { getOrCreateBeforeServer, closeBeforeServer } from './node/before-server.ts';

// Store the options reference for lazy server creation.
// Re-entrance guard: viteFinal is re-invoked when the second server applies
// presets.apply('viteFinal', ...). The guard prevents double-application.
let storedOptions: Options | null = null;

export const viteFinal = async (config: Record<string, unknown>, options: Options) => {
  // Re-entrance guard: if options are already stored, this is the second server's
  // viteFinal pass — return config untouched to prevent double-application.
  if (storedOptions) {
    return config;
  }

  storedOptions = options;
  return config;
};

export const experimental_devServer = async (_app: Record<string, unknown>, options: Options) => {
  const channel = (options as Options & { channel?: Channel }).channel;

  if (!channel) {
    logger.warn('[before-after] No channel available, addon will not function');
    return;
  }

  let repoRoot: string | null = null;
  let gitWatchers: ReturnType<typeof watch>[] = [];

  // Initialize git info
  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { execa } = await import('execa');
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
    repoRoot = stdout.trim();
  } catch {
    logger.info('[before-after] Git not available, addon will show informational message');
  }

  // Listen for server creation requests from the manager
  channel.on(EVENTS.REQUEST_SERVER, async () => {
    if (!storedOptions || !repoRoot) {
      channel.emit(EVENTS.SERVER_ERROR, {
        error: !repoRoot ? 'Git is not available' : 'Options not initialized',
      });
      return;
    }

    try {
      const result = await getOrCreateBeforeServer(storedOptions, repoRoot);
      channel.emit(EVENTS.SERVER_READY, { port: result.port });
    } catch (error) {
      logger.error(`[before-after] Failed to create server: ${error}`);
      channel.emit(EVENTS.SERVER_ERROR, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Watch .git/HEAD and the current branch ref for commit changes.
  // .git/HEAD changes on branch switches; the branch ref file changes on commits/amends.
  if (repoRoot) {
    try {
      const gitDir = join(repoRoot, '.git');

      const onGitChange = () => {
        logger.info('[before-after] Git ref changed, refreshing...');
        invalidateCache();
        channel.emit(EVENTS.HEAD_CHANGED);
      };

      const headWatcher = watch(join(gitDir, 'HEAD'), onGitChange);
      gitWatchers.push(headWatcher);

      // Watch the current branch ref file (e.g. .git/refs/heads/main) for commits/amends
      try {
        const headContent = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
        const refMatch = headContent.match(/^ref: (.+)$/);
        if (refMatch) {
          const refPath = join(gitDir, refMatch[1]);
          const refWatcher = watch(refPath, onGitChange);
          gitWatchers.push(refWatcher);
        }
      } catch {
        // Detached HEAD or ref file not readable — HEAD watcher alone is sufficient
      }
    } catch {
      logger.info('[before-after] Unable to watch git refs for changes');
    }
  }

  // Cleanup on shutdown
  const cleanup = async () => {
    for (const watcher of gitWatchers) {
      watcher.close();
    }
    gitWatchers = [];
    await closeBeforeServer();
  };

  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
};
