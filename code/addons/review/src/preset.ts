import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { createProxyMiddleware } from 'http-proxy-middleware';
import sirv from 'sirv';
import type { Channel } from 'storybook/internal/channels';
import type { Middleware, Options, ServerApp } from 'storybook/internal/types';

import type { FileChangeEvent } from 'storybook/internal/core-server';

import { BASELINE_PROXY_PATH, EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';

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

/** Test-only: reset the module-level cache between cases. */
export function __resetCache(): void {
  cached = undefined;
}

function prepareReview(payload: ReviewState): ReviewState {
  // Staleness is server-authoritative (set by the file-watch handler), so a
  // fresh push must never inherit a stale flag from the agent payload.
  const { stale: _untrustedStale, ...rest } = payload;
  return {
    ...rest,
    // Server-side timestamp is authoritative for "Created x minutes ago".
    createdAt: Date.now(),
  };
}

export interface ServerChannelOptions {
  /** Override the source-file-change subscription. Used by tests. */
  subscribeToSourceFileChanges?: SubscribeToSourceFileChanges;
}

/**
 * Storybook's preset hook that hands us the long-lived dev-server channel.
 *
 * Responsibilities:
 * - PUSH_REVIEW (from @storybook/addon-mcp): stamp the server createdAt,
 *   cache, broadcast as DISPLAY_REVIEW so any open tab updates.
 * - REQUEST_REVIEW (from a tab that just mounted): re-broadcast the cached
 *   payload as DISPLAY_REVIEW so the late tab catches up.
 */
export const experimental_serverChannel = async (
  channel: Channel,
  _options: Options,
  serverOptions: ServerChannelOptions = {}
) => {
  const subscribeToSourceFileChanges =
    serverOptions.subscribeToSourceFileChanges ?? defaultSubscribeToSourceFileChanges;

  channel.on(EVENTS.PUSH_REVIEW, (payload: ReviewState) => {
    // A fresh review starts non-stale; its new createdAt re-anchors staleness.
    cached = prepareReview(payload);
    channel.emit(EVENTS.DISPLAY_REVIEW, cached);
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

// Explicit origin of a deployed baseline Storybook to compare against. When set,
// it always wins so the baseline can be pinned to a specific remote build.
const BASELINE_TARGET_ORIGIN = process.env.STORYBOOK_REVIEW_BASELINE_ORIGIN;
// Fallback remote baseline used only when no env origin is set and no local
// build exists. Points at a temporary Chromatic build and should be replaced
// with a real per-project source before this graduates beyond experimental use.
const DEFAULT_BASELINE_TARGET_ORIGIN = 'https://next--635781f3500dd2c49e189caf.chromatic.com';
// Locally-built baseline Storybook, served directly when present so a project
// can compare against its own `storybook-static` instead of a remote origin.
const BASELINE_STATIC_DIR = 'storybook-static';

export const experimental_devServer = (app: ServerApp) => {
  // Resolution order: an explicit env origin proxies remotely; otherwise a
  // local `storybook-static` build is served directly; otherwise we proxy to
  // the default remote baseline.
  if (!BASELINE_TARGET_ORIGIN) {
    const baselineStaticDir = resolve(process.cwd(), BASELINE_STATIC_DIR);
    if (existsSync(baselineStaticDir) && statSync(baselineStaticDir).isDirectory()) {
      app.use(
        BASELINE_PROXY_PATH,
        sirv(baselineStaticDir, { dev: true, etag: true, extensions: [] }) as unknown as Middleware
      );
      return app;
    }
  }

  const proxyRequest = createProxyMiddleware({
    target: BASELINE_TARGET_ORIGIN ?? DEFAULT_BASELINE_TARGET_ORIGIN,
    changeOrigin: true,
    // The baseline origin is a remote server that can be slow or unreachable.
    // Bound the wait and respond deterministically so a dead connection fails
    // fast instead of hanging the review UI's baseline iframe.
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
