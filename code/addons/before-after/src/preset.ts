import { watch, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import type { InlineConfig, ViteDevServer } from 'vite';

import { EVENTS } from './constants.ts';
import { invalidateCache } from './node/git-file-at-head.ts';
import {
  beforeEnvironmentPlugin,
  invalidateBeforeEnvironment,
} from './node/before-environment-plugin.ts';
import { beforeContentPlugin } from './node/before-content-plugin.ts';
import {
  assertViteEnvironmentApiSupported,
  BeforeAfterUnsupportedViteError,
} from './node/circuit-breaker.ts';

// `viteFinal` is invoked once per dev server creation. Track per-config
// idempotency so plugin re-installation across `server.restart()` or
// concurrent dev servers doesn't double-register.
const initialisedConfigs = new WeakSet<InlineConfig>();

// Shared mutable holder so `viteFinal` (which creates the plugin) and
// `experimental_devServer` (which sets up git watchers + prewarm) can
// exchange the resolved ViteDevServer reference without a singleton module.
const serverHandoff: {
  server: ViteDevServer | null;
  onReady: ((server: ViteDevServer) => void) | null;
} = { server: null, onReady: null };

type RuntimeChannel = Pick<Channel, 'emit' | 'on'>;

function getChannel(options: Options): RuntimeChannel | null {
  const ch = (options as Options & { channel?: unknown }).channel;
  if (ch && typeof ch === 'object' && 'emit' in ch && 'on' in ch) {
    return ch as RuntimeChannel;
  }
  return null;
}

export const viteFinal = async (config: InlineConfig, options: Options) => {
  if (initialisedConfigs.has(config)) {
    return config;
  }
  initialisedConfigs.add(config);

  // Fail loud on unsupported Vite at viteFinal entry — long before
  // `createServer` resolves — so users get an actionable error rather than an
  // obscure failure deeper in plugin initialisation.
  assertViteEnvironmentApiSupported();

  const channel = getChannel(options);
  const repoRoot = await discoverRepoRoot();

  // Prepend (not append) so `beforeEnvironmentPlugin.resolveId` runs BEFORE
  // builder-vite's `code-generator-plugin` and `storybook-project-annotations-plugin`.
  // The hook delegates via `this.resolve({ skipSelf: true })` and then attaches
  // the `?env=before` marker to the resolved id — this only works if our hook
  // sees the spec FIRST (otherwise a `pre`-enforce plugin earlier in the array
  // resolves it and our post-processing never fires).
  config.plugins = [
    beforeEnvironmentPlugin({
      channel,
      repoRoot: repoRoot ?? undefined,
      onServerReady: (server) => {
        serverHandoff.server = server;
        serverHandoff.onReady?.(server);
      },
    }),
    ...(repoRoot ? [beforeContentPlugin({ repoRoot })] : []),
    ...(config.plugins ?? []),
  ];

  return config;
};

async function discoverRepoRoot(): Promise<string | null> {
  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { execa } = await import('execa');
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
    return stdout.trim();
  } catch {
    return null;
  }
}

export const experimental_devServer = async (app: Record<string, unknown>, options: Options) => {
  const channel = getChannel(options);

  if (!channel) {
    logger.warn('[before-after] No channel available, addon will not function');
    return app;
  }

  const repoRoot = await discoverRepoRoot();
  if (!repoRoot) {
    logger.info('[before-after] Git not available, addon will show informational message');
    channel.emit(EVENTS.ADDON_DISABLED, { reason: 'git-unavailable' });
    return app;
  }

  let envApiServerRef: ViteDevServer | null = null;
  const onServerReady = (server: ViteDevServer) => {
    envApiServerRef = server;
    try {
      assertViteEnvironmentApiSupported(server);
    } catch (err) {
      logger.warn(`[before-after] ${(err as Error).message}`);
      return;
    }
    void prewarmChangedStories(server, repoRoot);
  };
  serverHandoff.onReady = onServerReady;
  if (serverHandoff.server) onServerReady(serverHandoff.server);

  // ── Git watchers ───────────────────────────────────────────────────────────
  let gitWatchers: ReturnType<typeof watch>[] = [];
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
      if (envApiServerRef) invalidateBeforeEnvironment(envApiServerRef);
      channel.emit(EVENTS.HEAD_CHANGED);
    };

    const onHeadChange = () => {
      logger.info('[before-after] HEAD changed, refreshing...');
      invalidateCache();
      if (envApiServerRef) invalidateBeforeEnvironment(envApiServerRef);
      channel.emit(EVENTS.HEAD_CHANGED);
      watchCurrentBranchRef();
    };

    const headWatcher = watch(join(gitDir, 'HEAD'), onHeadChange);
    gitWatchers.push(headWatcher);
    watchCurrentBranchRef();
  } catch {
    logger.info('[before-after] Unable to watch git refs for changes');
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = () => {
    for (const watcher of gitWatchers) {
      watcher.close();
    }
    gitWatchers = [];
  };

  process.once('SIGINT', () => {
    cleanup();
    process.kill(process.pid, 'SIGINT');
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.kill(process.pid, 'SIGTERM');
  });

  return app;
};

/**
 * Discover changed story files via git diff and eagerly trigger compilation
 * with the `?env=before` marker so the before iframe is ready when the user
 * clicks Changes. Pre-warming runs against the client environment (the only
 * environment in the new single-env model); the marker on the URL routes
 * `beforeContentPlugin.load` to serve HEAD content for these requests.
 */
async function prewarmChangedStories(server: ViteDevServer, repoRoot: string): Promise<void> {
  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { execa } = await import('execa');

    const [diffResult, untrackedResult] = await Promise.all([
      execa('git', ['diff', '--name-only', 'HEAD'], { cwd: repoRoot }),
      execa('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repoRoot }),
    ]);

    const allChanged = [
      ...diffResult.stdout.split('\n'),
      ...untrackedResult.stdout.split('\n'),
    ].filter((f) => f.length > 0);

    const storyFiles = allChanged.filter((f) => f.includes('.stories.') || f.includes('.story.'));
    if (storyFiles.length === 0) return;

    const env = server.environments.client;
    if (!env) return;
    const absolutePaths = storyFiles.map((f) => `/@fs/${join(repoRoot, f)}?env=before`);
    logger.info(`[before-after] Pre-warming ${storyFiles.length} changed story files`);
    await Promise.allSettled(absolutePaths.map((p) => env.warmupRequest(p)));
    logger.info('[before-after] Pre-warming complete');
  } catch (e) {
    if (e instanceof BeforeAfterUnsupportedViteError) {
      logger.warn(`[before-after] ${e.message}`);
      return;
    }
    logger.debug(`[before-after] Story prewarm skipped: ${e}`);
  }
}
