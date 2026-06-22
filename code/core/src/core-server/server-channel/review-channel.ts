import type { Channel } from 'storybook/internal/channels';

import { getService } from '../../shared/open-service/server.ts';
import type { ModuleGraphService } from '../../shared/open-service/services/module-graph/definition.ts';
import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import type { ReviewState } from '../../shared/review/review-state.ts';

/**
 * Window after a review's `createdAt` during which graph changes are ignored.
 * Absorbs the agent's own edits (which precede the display-review call) whose
 * file-system events may land a few milliseconds after the review is cached,
 * preventing a freshly-pushed review from being marked stale immediately.
 */
const STALE_GRACE_MS = 10_000;

type SubscribeToModuleGraphChanges = (onChange: () => void) => () => void;

/**
 * Default subscription to the `core/module-graph` open service. The review goes
 * stale when any file in the story module graph changes (the service's revision
 * only advances for in-graph changes, so unrelated file edits never trip it).
 * The `services` preset registers the service before `experimental_serverChannel`
 * runs, so the lookup succeeds synchronously here; if it's unavailable (e.g. a
 * builder without module-graph support), staleness simply never triggers.
 */
const defaultSubscribeToModuleGraphChanges: SubscribeToModuleGraphChanges = (onChange) => {
  try {
    const service = getService<ModuleGraphService>('core/module-graph');
    // Omit the input to watch the entire graph. The initial emission carries
    // revision 0 (or the current revision at subscribe time); only subsequent
    // advances represent a change after the review was cached.
    return service.queries.getGraphRevision.subscribe(undefined, (revision) => {
      if (revision > 0) {
        onChange();
      }
    });
  } catch {
    // Module graph unavailable (e.g. builder without support); no staleness.
    return () => {};
  }
};

export interface ReviewChannelOptions {
  /** Override the module-graph-change subscription. Used by tests. */
  subscribeToModuleGraphChanges?: SubscribeToModuleGraphChanges;
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

/**
 * Owns the server-side review cache and staleness tracking.
 *
 * - PUSH_REVIEW (from `@storybook/addon-mcp`): stamp the server createdAt,
 *   cache, broadcast as DISPLAY_REVIEW so any open tab updates.
 * - REQUEST_REVIEW (from a tab that just mounted): re-broadcast the cached
 *   payload as DISPLAY_REVIEW so the late tab catches up.
 * - DISMISS_REVIEW: clear the cache and broadcast REVIEW_DISMISSED.
 *
 * The cache is a single in-memory slot scoped to this dev-server channel; it is
 * intentionally not persisted, so a restart wipes the slate.
 */
export function initReviewChannel(channel: Channel, options: ReviewChannelOptions = {}) {
  const subscribeToModuleGraphChanges =
    options.subscribeToModuleGraphChanges ?? defaultSubscribeToModuleGraphChanges;

  let cached: ReviewState | undefined;

  channel.on(REVIEW_EVENTS.PUSH_REVIEW, (payload: ReviewState) => {
    // A fresh review starts non-stale; its new createdAt re-anchors staleness.
    cached = prepareReview(payload);
    channel.emit(REVIEW_EVENTS.DISPLAY_REVIEW, cached);
  });

  channel.on(REVIEW_EVENTS.REQUEST_REVIEW, () => {
    if (cached) {
      channel.emit(REVIEW_EVENTS.DISPLAY_REVIEW, cached);
    }
  });

  channel.on(REVIEW_EVENTS.DISMISS_REVIEW, (returnSearch?: string | null) => {
    cached = undefined;
    channel.emit(REVIEW_EVENTS.REVIEW_DISMISSED, returnSearch ?? null);
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
    channel.emit(REVIEW_EVENTS.REVIEW_STALE);
  });

  return channel;
}
