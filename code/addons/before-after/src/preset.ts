import { watch, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';
import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import type { InlineConfig, ViteDevServer } from 'vite';

import { EVENTS } from './constants.ts';
import { invalidateCache } from './node/git-file-at-head.ts';
import {
  getOrCreateBeforeServer,
  closeBeforeServer,
  invalidateModuleGraph as invalidateSubprocessModuleGraph,
} from './node/before-server.ts';
import {
  beforeEnvironmentPlugin,
  invalidateBeforeEnvironment,
} from './node/before-environment-plugin.ts';
import { beforeContentPlugin } from './node/before-content-plugin.ts';
import {
  assertViteEnvironmentApiSupported,
  isEnvApiEnabled,
  BeforeAfterUnsupportedViteError,
} from './node/circuit-breaker.ts';
import { registerEnvApiServerHook } from './node/server-ready-hook.ts';

// ── Re-entrance state ────────────────────────────────────────────────────────
//
// `viteFinal` is invoked once for the main dev server and a second time when
// the legacy subprocess server applies presets. The first invocation captures
// the `Options` for later channel handlers; subsequent invocations against the
// SAME `InlineConfig` must be no-ops to avoid registering plugins twice.
//
// We track the per-config "already initialised" state with a `WeakSet`. Using a
// `WeakSet` keyed on the config object replaces the old module-level
// `storedOptions` singleton (K11): it is safe across `server.restart()` and
// concurrent dev server creations because each `InlineConfig` is a distinct
// object reference.
const initialisedConfigs = new WeakSet<InlineConfig>();
let capturedOptions: Options | null = null;

// `Options.channel` is widened to `ChannelLike` upstream; coerce to a stricter
// callable shape at the use site only.
type RuntimeChannel = Pick<Channel, 'emit' | 'on'>;

function getChannel(options: Options): RuntimeChannel | null {
  const ch = (options as Options & { channel?: unknown }).channel;
  if (ch && typeof ch === 'object' && 'emit' in ch && 'on' in ch) {
    return ch as RuntimeChannel;
  }
  return null;
}

export const viteFinal = async (config: InlineConfig, options: Options) => {
  // First call stores the options for later use by `experimental_devServer`. We
  // intentionally do not throw on subsequent calls — a second pass on a fresh
  // config (e.g. the subprocess re-applying presets) needs to receive the same
  // mutated config back.
  if (!capturedOptions) {
    capturedOptions = options;
  }

  if (initialisedConfigs.has(config)) {
    return config;
  }
  initialisedConfigs.add(config);

  if (isEnvApiEnabled()) {
    // Fail loud on unsupported Vite (K12). Doing this at viteFinal entry — long
    // before `createServer` resolves — gives users an actionable error path
    // instead of an obscure failure deeper in plugin initialisation.
    assertViteEnvironmentApiSupported();

    const channel = getChannel(options);
    const repoRoot = await discoverRepoRoot();

    config.plugins = [
      ...(config.plugins ?? []),
      beforeEnvironmentPlugin({ channel }),
      ...(repoRoot ? [beforeContentPlugin({ repoRoot, scopeToBeforeEnvironment: true })] : []),
    ];
  }

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

export const experimental_devServer = async (_app: Record<string, unknown>, options: Options) => {
  const channel = getChannel(options);

  if (!channel) {
    logger.warn('[before-after] No channel available, addon will not function');
    return;
  }

  const envApiEnabled = isEnvApiEnabled();
  const repoRoot = await discoverRepoRoot();
  if (!repoRoot) {
    logger.info('[before-after] Git not available, addon will show informational message');
  }

  // ── Subprocess path (default) ──────────────────────────────────────────────
  let eagerServerPromise: Promise<{ port: number }> | null = null;

  if (repoRoot && !envApiEnabled) {
    const root = repoRoot;
    eagerServerPromise = (async () => {
      const result = await getOrCreateBeforeServer(options, root);
      logger.info(`[before-after] Before-server ready on port ${result.port}`);
      await prewarmChangedStories({ kind: 'subprocess', server: result.viteServer }, root);
      return { port: result.port };
    })();

    eagerServerPromise.catch((error) => {
      logger.error(`[before-after] Eager server startup failed: ${error}`);
      eagerServerPromise = null;
    });
  }

  // ── Env-API path: resolve the main dev server ref for prewarm + HMR ───────
  //
  // The plugin's `configureServer` calls `notifyEnvApiServerReady`; we listen
  // for that single event rather than polling. Subscribing once here is enough
  // — the hook re-fires on every server creation (e.g. `server.restart()`).
  let envApiServerRef: ViteDevServer | null = null;
  registerEnvApiServerHook((server) => {
    envApiServerRef = server;
    if (envApiEnabled) {
      try {
        assertViteEnvironmentApiSupported(server);
      } catch (err) {
        logger.warn(`[before-after] ${(err as Error).message}`);
        return;
      }
      if (repoRoot) {
        void prewarmChangedStories({ kind: 'env-api', server }, repoRoot);
      }
    }
  });

  const respondReady = (kind: 'subprocess' | 'env-api', payload: { port: number; url: string }) => {
    // Legacy event for backward compatibility — the subprocess path always
    // carries a real port; the env-API path carries the sentinel `-1`.
    channel.emit(EVENTS.SERVER_READY, { port: payload.port });
    channel.emit(EVENTS.SERVER_READY_V2, { url: payload.url, environment: kind });
  };

  let lastReadyPayload: { kind: 'subprocess' | 'env-api'; port: number; url: string } | null = null;

  // ── Channel handlers ───────────────────────────────────────────────────────
  channel.on(EVENTS.REQUEST_SERVER, async () => {
    if (!repoRoot) {
      channel.emit(EVENTS.SERVER_ERROR, { error: 'Git is not available' });
      return;
    }

    if (envApiEnabled) {
      const payload = { kind: 'env-api' as const, port: -1, url: '' };
      lastReadyPayload = payload;
      respondReady('env-api', payload);
      return;
    }

    try {
      let port: number;
      if (eagerServerPromise) {
        ({ port } = await eagerServerPromise);
      } else {
        const result = await getOrCreateBeforeServer(options, repoRoot);
        port = result.port;
      }
      const url = `http://localhost:${port}`;
      lastReadyPayload = { kind: 'subprocess', port, url };
      respondReady('subprocess', { port, url });
    } catch (error) {
      logger.error(`[before-after] Failed to create server: ${error}`);
      channel.emit(EVENTS.SERVER_ERROR, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Idempotent status poll (K6 / sync-emit-before-listener mitigation).
  channel.on(EVENTS.REQUEST_SERVER_STATUS, () => {
    if (lastReadyPayload) {
      respondReady(lastReadyPayload.kind, {
        port: lastReadyPayload.port,
        url: lastReadyPayload.url,
      });
    }
  });

  // ── Git watchers ───────────────────────────────────────────────────────────
  let gitWatchers: ReturnType<typeof watch>[] = [];
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
        if (envApiEnabled) {
          if (envApiServerRef) invalidateBeforeEnvironment(envApiServerRef);
        } else {
          invalidateSubprocessModuleGraph();
        }
        channel.emit(EVENTS.HEAD_CHANGED);
      };

      const onHeadChange = () => {
        logger.info('[before-after] HEAD changed, refreshing...');
        invalidateCache();
        if (envApiEnabled) {
          if (envApiServerRef) invalidateBeforeEnvironment(envApiServerRef);
        } else {
          invalidateSubprocessModuleGraph();
        }
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

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = async () => {
    for (const watcher of gitWatchers) {
      watcher.close();
    }
    gitWatchers = [];
    if (!envApiEnabled) {
      await closeBeforeServer();
    }
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

// ── Prewarm ──────────────────────────────────────────────────────────────────
//
// The "before" view is responsive only if the modules it serves are already
// compiled when the user clicks Changes. We discover changed story files via
// `git diff` and trigger Vite to compile them.

type PrewarmTarget =
  | { kind: 'subprocess'; server: import('vite').ViteDevServer }
  | { kind: 'env-api'; server: ViteDevServer };

/**
 * Discover changed story files via git diff and eagerly trigger compilation
 * in the appropriate environment.
 *
 * - On the subprocess path the legacy `viteServer.warmupRequest` is used.
 * - On the env-API path we route through the `storybookBefore` environment so
 *   the before iframe — not the client — gets the compiled output.
 */
async function prewarmChangedStories(target: PrewarmTarget, repoRoot: string): Promise<void> {
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

    const absolutePaths = storyFiles.map((f) => `/@fs/${join(repoRoot, f)}`);

    if (target.kind === 'subprocess') {
      logger.info(`[before-after] Pre-warming ${storyFiles.length} changed story files`);
      await Promise.allSettled(absolutePaths.map((p) => target.server.warmupRequest(p)));
      logger.info('[before-after] Pre-warming complete');
      return;
    }

    const env = target.server.environments.storybookBefore;
    if (!env) return;
    logger.info(
      `[before-after] Pre-warming ${storyFiles.length} changed story files (storybookBefore env)`
    );
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
