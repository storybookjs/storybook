import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Channel } from 'storybook/internal/channels';
import type { Middleware, Options, ServerApp } from 'storybook/internal/types';
import sirv from 'sirv';

import type { FileChangeEvent } from 'storybook/internal/core-server';

import { EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import { currentGitBranch } from './node/git-branch.ts';

const BASELINE_PROXY_PATH = '/__review-baseline';
const BASELINE_TARGET_ORIGIN = 'https://next--635781f3500dd2c49e189caf.chromatic.com';
const BASELINE_STATIC_DIR = 'storybook-static';

export const experimental_devServer = (app: ServerApp) => {
  const baselineStaticDir = resolve(process.cwd(), BASELINE_STATIC_DIR);
  const hasLocalBaseline =
    existsSync(baselineStaticDir) && statSync(baselineStaticDir).isDirectory();

  if (hasLocalBaseline) {
    app.use(
      BASELINE_PROXY_PATH,
      sirv(baselineStaticDir, { dev: true, etag: true, extensions: [] }) as unknown as Middleware
    );
    return app;
  }

  const proxyRequest = createProxyMiddleware({
    target: BASELINE_TARGET_ORIGIN,
    changeOrigin: true,
    // The baseline origin is a remote Chromatic server that can be slow or
    // unreachable. Bound the wait and respond deterministically so a dead
    // connection fails fast instead of hanging the review UI's baseline iframe.
    timeout: 30_000,
    proxyTimeout: 30_000,
    pathRewrite: (path) =>
      path.startsWith(BASELINE_PROXY_PATH) ? path.slice(BASELINE_PROXY_PATH.length) || '/' : path,
    on: {
      error: (_error, _req, res) => {
        // `res` is a net.Socket on WebSocket upgrades; only HTTP responses
        // carry a status code.
        if ('writeHead' in res) {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
          }
          res.end('Baseline preview is unavailable.');
        }
      },
    },
  }) as unknown as Middleware;

  app.use(BASELINE_PROXY_PATH, proxyRequest);
  return app;
};

/**
 * Window after a review's `createdAt` during which source changes are ignored.
 * Absorbs the agent's own edits (which precede the display-review call) whose
 * file-system events may land a few milliseconds after the review is cached,
 * preventing a freshly-pushed review from being marked stale immediately.
 */
const STALE_GRACE_MS = 1000;

type SubscribeToSourceFileChanges = (listener: (event: FileChangeEvent) => void) => () => void;

/**
 * Default subscription to core's change-detection file-watch. Imported lazily
 * so merely loading this preset (e.g. in unit tests) does not pull in
 * core-server; failures degrade to "staleness never triggers".
 */
const defaultSubscribeToSourceFileChanges: SubscribeToSourceFileChanges = (listener) => {
  let unsubscribe: () => void = () => {};
  let cancelled = false;
  void import('storybook/internal/core-server')
    .then((coreServer) => {
      if (!cancelled) {
        unsubscribe = coreServer.experimental_subscribeToSourceFileChanges(listener);
      }
    })
    .catch(() => {
      // Change detection unavailable (e.g. builder without support); no staleness.
    });
  return () => {
    cancelled = true;
    unsubscribe();
  };
};

// Server-side cache for the agent-pushed review. Storybook's dev server is
// long-lived; this single slot survives across reconnecting browser tabs and
// is what REQUEST_REVIEW replays. It is intentionally not persisted to disk —
// a dev-server restart wipes the slate.
let cached: ReviewState | undefined;
let latestPushSeq = 0;

/** Test-only: reset the module-level cache between cases. */
export function __resetCache(): void {
  cached = undefined;
  latestPushSeq = 0;
}

async function enrichWithBranch(
  payload: ReviewState,
  resolveBranch: (cwd: string) => Promise<string | undefined>
): Promise<ReviewState> {
  const branchName = await resolveBranch(process.cwd());
  const enriched: ReviewState = {
    ...payload,
    // branchName is server-resolved; overwrite any agent-supplied value so an
    // unresolvable local branch can't leave a spoofed branch in the payload.
    branchName,
    // Server-side timestamp is authoritative for "Created x minutes ago".
    createdAt: Date.now(),
  };
  if (enriched.branchName === undefined) {
    delete enriched.branchName;
  }
  return enriched;
}

export interface ServerChannelOptions {
  /** Override the git-branch resolver. Used by tests. */
  resolveBranch?: (cwd: string) => Promise<string | undefined>;
  /** Override the source-file-change subscription. Used by tests. */
  subscribeToSourceFileChanges?: SubscribeToSourceFileChanges;
}

/**
 * Storybook's preset hook that hands us the long-lived dev-server channel.
 *
 * Responsibilities:
 * - PUSH_REVIEW (from @storybook/addon-mcp): enrich with git branchName,
 *   cache, broadcast as DISPLAY_REVIEW so any open tab updates.
 * - REQUEST_REVIEW (from a tab that just mounted): re-broadcast the cached
 *   payload as DISPLAY_REVIEW so the late tab catches up.
 */
export const experimental_serverChannel = async (
  channel: Channel,
  _options: Options,
  serverOptions: ServerChannelOptions = {}
) => {
  const resolveBranch = serverOptions.resolveBranch ?? currentGitBranch;
  const subscribeToSourceFileChanges =
    serverOptions.subscribeToSourceFileChanges ?? defaultSubscribeToSourceFileChanges;

  channel.on(EVENTS.PUSH_REVIEW, async (payload: ReviewState) => {
    const seq = ++latestPushSeq;
    const enriched = await enrichWithBranch(payload, resolveBranch);
    if (seq !== latestPushSeq) {
      return;
    }
    // A fresh review starts non-stale; its new createdAt re-anchors staleness.
    cached = enriched;
    channel.emit(EVENTS.DISPLAY_REVIEW, enriched);
  });

  channel.on(EVENTS.REQUEST_REVIEW, () => {
    if (cached) {
      channel.emit(EVENTS.DISPLAY_REVIEW, cached);
    }
  });

  // Mark the cached review stale on the first source change that lands after
  // its createdAt (past the grace window). Staleness rides on the cached state
  // so REQUEST_REVIEW replays it to tabs that open after the change.
  subscribeToSourceFileChanges(() => {
    if (!cached || cached.stale || cached.createdAt === undefined) {
      return;
    }
    if (Date.now() < cached.createdAt + STALE_GRACE_MS) {
      return;
    }
    cached = { ...cached, stale: true };
    channel.emit(EVENTS.REVIEW_STALE);
  });

  return channel;
};
