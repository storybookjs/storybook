import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import type { ModuleGraphService } from 'storybook/internal/core-server';

import { EVENTS } from './constants.ts';
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

  channel.on(EVENTS.DISMISS_REVIEW, (returnSearch?: string | null) => {
    cached = undefined;
    channel.emit(EVENTS.REVIEW_DISMISSED, returnSearch ?? null);
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
