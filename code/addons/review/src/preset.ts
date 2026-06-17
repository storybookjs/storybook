import { existsSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { createProxyMiddleware } from 'http-proxy-middleware';
import sirv from 'sirv';
import type { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';
import type { Middleware, Options, ServerApp } from 'storybook/internal/types';

import type { ModuleGraphService } from 'storybook/internal/core-server';

import { BASELINE_PROXY_PATH, EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';

/**
 * Window after a review's `createdAt` during which graph changes are ignored.
 * Absorbs the agent's own edits (which precede the display-review call) whose
 * file-system events may land a few milliseconds after the review is cached,
 * preventing a freshly-pushed review from being marked stale immediately.
 */
const STALE_GRACE_MS = 1000;

type SubscribeToModuleGraphChanges = (onChange: () => void) => () => void;

/**
 * Default subscription to the `core/module-graph` open service. The review goes
 * stale when any file in the story module graph changes (the service's revision
 * only advances for in-graph changes, so unrelated file edits never trip it).
 * The service is imported lazily so merely loading this preset (e.g. in unit
 * tests) does not pull in core-server; if the service is unavailable (e.g. a
 * builder without module-graph support), staleness simply never triggers.
 */
const defaultSubscribeToModuleGraphChanges: SubscribeToModuleGraphChanges = (onChange) => {
  let unsubscribe: () => void = () => {};
  let cancelled = false;
  void import('storybook/internal/core-server')
    .then(({ getService }) => {
      if (cancelled) {
        return;
      }
      const service = getService<ModuleGraphService>('core/module-graph');
      // Omit the input to watch the entire graph. The initial emission carries
      // revision 0 (or the current revision at subscribe time); only subsequent
      // advances represent a change after the review was cached.
      unsubscribe = service.queries.getGraphRevision.subscribe(undefined, (revision) => {
        if (revision > 0) {
          onChange();
        }
      });
    })
    .catch(() => {
      // Module graph unavailable (e.g. builder without support); no staleness.
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
  /** Override the module-graph-change subscription. Used by tests. */
  subscribeToModuleGraphChanges?: SubscribeToModuleGraphChanges;
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
  const subscribeToModuleGraphChanges =
    serverOptions.subscribeToModuleGraphChanges ?? defaultSubscribeToModuleGraphChanges;

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

  // Mark the cached review stale on the first module-graph change that lands
  // after its createdAt (past the grace window). Staleness rides on the cached
  // state so REQUEST_REVIEW replays it to tabs that open after the change.
  subscribeToModuleGraphChanges(() => {
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

// The deployed baseline Storybook to compare against. A single env var that is
// either a project-relative static-build directory (served directly) or a remote
// origin URL (proxied). There is no default — without it, no baseline is served.
const BASELINE = process.env.STORYBOOK_REVIEW_BASELINE;

/**
 * Resolve a `STORYBOOK_REVIEW_BASELINE` value to a project-relative static dir.
 * Returns the absolute path when the value is a relative path that stays inside
 * the cwd; returns undefined for URL-like values, absolute paths, or paths that
 * escape the cwd via `..` — those are not treated as a local static dir.
 */
const resolveBaselineStaticDir = (value: string): string | undefined => {
  if (/^[a-zA-Z][\w+.-]*:\/\//.test(value) || isAbsolute(value)) {
    return undefined;
  }
  const root = process.cwd();
  const resolved = resolve(root, value);
  if (relative(root, resolved).startsWith('..')) {
    return undefined;
  }
  return resolved;
};

const isValidBaselineOrigin = (value: string): boolean => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Storybook preset hook that serves the review baseline on the dev server.
 *
 * The review UI compares the current story against a baseline Storybook in a
 * side-by-side iframe. That baseline must be reachable from the same origin as
 * the dev server (otherwise the iframe is blocked). This hook mounts it at
 * `/__review-baseline` when `STORYBOOK_REVIEW_BASELINE` is set:
 *
 * - A project-relative static-build directory is served directly via sirv.
 * - An `http:`/`https:` URL is proxied so a deployed Storybook can be used
 *   without a local build.
 *
 * When the env var is unset or invalid, the hook is a no-op — review still
 * works, but baseline comparison is unavailable.
 */
export const experimental_devServer = (app: ServerApp) => {
  if (!BASELINE) {
    return app;
  }

  // A safe relative path is served directly as a local static build…
  const staticDir = resolveBaselineStaticDir(BASELINE);
  if (staticDir) {
    if (!existsSync(staticDir) || !statSync(staticDir).isDirectory()) {
      logger.warn(
        `[addon-review] STORYBOOK_REVIEW_BASELINE "${BASELINE}" is not an existing directory; ignoring.`
      );
      return app;
    }
    app.use(
      BASELINE_PROXY_PATH,
      sirv(staticDir, { dev: true, etag: true, extensions: [] }) as unknown as Middleware
    );
    return app;
  }

  // …otherwise a valid URL is proxied as a remote origin.
  if (!isValidBaselineOrigin(BASELINE)) {
    logger.warn(
      `[addon-review] STORYBOOK_REVIEW_BASELINE "${BASELINE}" is neither a valid relative path nor a valid URL; ignoring.`
    );
    return app;
  }

  const proxyRequest = createProxyMiddleware({
    target: BASELINE,
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
