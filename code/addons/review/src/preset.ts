import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import type { FileChangeEvent } from 'storybook/internal/core-server';

import { EVENTS } from './constants.ts';
import type { ReviewState } from './review-state.ts';
import { currentGitBranch } from './node/git-branch.ts';

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
    // Server-side timestamp is authoritative for "Created x minutes ago".
    createdAt: Date.now(),
  };
  return branchName ? { ...enriched, branchName } : enriched;
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
