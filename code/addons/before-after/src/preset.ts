import { watch, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { EVENTS } from './constants.ts';
import { invalidateCache } from './node/git-file-at-head.ts';
import {
  getOrCreateBeforeServer,
  closeBeforeServer,
  invalidateModuleGraph,
} from './node/before-server.ts';

// Re-entrance guard: viteFinal is called once for the main server and once when
// the before-server applies presets.apply('viteFinal', ...). The guard captures
// options on the first call and prevents double-application on re-entry.
let storedOptions: Options | null = null;

export const viteFinal = async (config: Record<string, unknown>, options: Options) => {
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

  // Discover the git repo root
  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { execa } = await import('execa');
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
    repoRoot = stdout.trim();
  } catch {
    logger.info('[before-after] Git not available, addon will show informational message');
  }

  // --- Eager server startup ---
  // Begin creating the before-server immediately instead of waiting for the user
  // to open the Changes page. The creation runs asynchronously — this hook returns
  // without blocking so the main Storybook server keeps booting. By the time the
  // user clicks "Changes", the before-server is already warmed up.
  //
  // Note: we use `options` directly (the parameter) rather than `storedOptions`
  // because viteFinal hasn't been called yet at this point in the lifecycle.
  let eagerServerPromise: Promise<{ port: number }> | null = null;

  if (repoRoot) {
    const root = repoRoot;
    eagerServerPromise = (async () => {
      const result = await getOrCreateBeforeServer(options, root);
      logger.info(`[before-after] Before-server ready on port ${result.port}`);

      // Prewarm changed story files eagerly
      await prewarmChangedStories(result.viteServer, root);

      return { port: result.port };
    })();

    eagerServerPromise.catch((error) => {
      logger.error(`[before-after] Eager server startup failed: ${error}`);
      eagerServerPromise = null;
    });
  }

  // --- Channel handler for manager requests ---
  // When the manager requests the server, return the port from the eagerly-started
  // server, or start one on-demand if eager startup was skipped/failed.
  channel.on(EVENTS.REQUEST_SERVER, async () => {
    if (!repoRoot) {
      channel.emit(EVENTS.SERVER_ERROR, { error: 'Git is not available' });
      return;
    }

    try {
      if (eagerServerPromise) {
        const { port } = await eagerServerPromise;
        channel.emit(EVENTS.SERVER_READY, { port });
      } else {
        const result = await getOrCreateBeforeServer(options, repoRoot);
        channel.emit(EVENTS.SERVER_READY, { port: result.port });
      }
    } catch (error) {
      logger.error(`[before-after] Failed to create server: ${error}`);
      channel.emit(EVENTS.SERVER_ERROR, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // --- Git watchers ---
  // Watch .git/HEAD and the current branch ref for commit changes.
  // .git/HEAD changes on branch switches; the branch ref file changes on commits/amends.
  if (repoRoot) {
    try {
      const gitDir = join(repoRoot, '.git');
      let refWatcher: ReturnType<typeof watch> | null = null;

      const watchCurrentBranchRef = () => {
        if (refWatcher) {
          refWatcher.close();
          refWatcher = null;
        }
        try {
          const headContent = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
          const refMatch = headContent.match(/^ref: (.+)$/);
          if (refMatch) {
            const refPath = join(gitDir, refMatch[1]);
            refWatcher = watch(refPath, onRefChange);
            gitWatchers.push(refWatcher);
          }
        } catch {
          // Detached HEAD or ref file not readable — HEAD watcher alone is sufficient
        }
      };

      const onRefChange = () => {
        logger.info('[before-after] Branch ref changed, refreshing...');
        invalidateCache();
        invalidateModuleGraph();
        channel.emit(EVENTS.HEAD_CHANGED);
      };

      const onHeadChange = () => {
        logger.info('[before-after] HEAD changed, refreshing...');
        invalidateCache();
        invalidateModuleGraph();
        channel.emit(EVENTS.HEAD_CHANGED);
        watchCurrentBranchRef();
      };

      const headWatcher = watch(join(gitDir, 'HEAD'), onHeadChange);
      gitWatchers.push(headWatcher);
      watchCurrentBranchRef();
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

  process.once('SIGINT', async () => {
    await cleanup();
    process.kill(process.pid, 'SIGINT');
  });
  process.once('SIGTERM', async () => {
    await cleanup();
    process.kill(process.pid, 'SIGTERM');
  });
};

/**
 * Discover changed story files via git diff and eagerly request them from the
 * before-server's Vite instance. This triggers dependency optimization and
 * module compilation in the background so the first iframe load is fast.
 */
async function prewarmChangedStories(
  viteServer: import('vite').ViteDevServer,
  repoRoot: string
): Promise<void> {
  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { execa } = await import('execa');

    // Get all modified, added, and untracked files
    const [diffResult, untrackedResult] = await Promise.all([
      execa('git', ['diff', '--name-only', 'HEAD'], { cwd: repoRoot }),
      execa('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoRoot }),
    ]);

    const allChanged = [
      ...diffResult.stdout.split('\n'),
      ...untrackedResult.stdout.split('\n'),
    ].filter((f) => f.length > 0);

    // Filter to story files
    const storyFiles = allChanged.filter(
      (f) => f.includes('.stories.') || f.includes('.story.')
    );

    if (storyFiles.length > 0) {
      // Convert repo-relative paths to Vite-resolvable paths (/@fs/absolute)
      const absolutePaths = storyFiles.map((f) => `/@fs/${join(repoRoot, f)}`);
      logger.info(`[before-after] Pre-warming ${storyFiles.length} changed story files`);
      await Promise.allSettled(absolutePaths.map((p) => viteServer.warmupRequest(p)));
      logger.info('[before-after] Pre-warming complete');
    }
  } catch (e) {
    logger.debug(`[before-after] Story prewarm skipped: ${e}`);
  }
}
