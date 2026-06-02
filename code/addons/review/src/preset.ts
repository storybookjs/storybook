import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Channel } from 'storybook/internal/channels';
import type { Middleware, Options, ServerApp } from 'storybook/internal/types';

import { EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import { currentGitBranch } from './node/git-branch.ts';

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
    // Server-side timestamp is authoritative for "Created x minutes ago".
    createdAt: Date.now(),
  };
  return branchName ? { ...enriched, branchName } : enriched;
}

export interface ServerChannelOptions {
  /** Override the git-branch resolver. Used by tests. */
  resolveBranch?: (cwd: string) => Promise<string | undefined>;
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

  channel.on(EVENTS.PUSH_REVIEW, async (payload: ReviewState) => {
    const seq = ++latestPushSeq;
    const enriched = await enrichWithBranch(payload, resolveBranch);
    if (seq !== latestPushSeq) {
      return;
    }
    cached = enriched;
    channel.emit(EVENTS.DISPLAY_REVIEW, enriched);
  });

  channel.on(EVENTS.REQUEST_REVIEW, () => {
    if (cached) {
      channel.emit(EVENTS.DISPLAY_REVIEW, cached);
    }
  });

  return channel;
};

const BASELINE_PROXY_PATH = '/__review-baseline';
const BASELINE_TARGET_ORIGIN = 'https://next--635781f3500dd2c49e189caf.chromatic.com';

export const experimental_devServer = (app: ServerApp) => {
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
