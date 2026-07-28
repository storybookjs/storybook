import type { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';

import { getService } from '../../shared/open-service/server.ts';
import type { ModuleGraphService } from '../../shared/open-service/services/module-graph/definition.ts';
import type { ReviewService } from '../../shared/open-service/services/review/definition.ts';
import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import type { ReviewState } from '../../shared/review/review-state.ts';

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
    const service = getService<ModuleGraphService>('core/module-graph', { internal: true });
    // Omit the input to watch the entire graph. The initial emission carries
    // revision 0 (or the current revision at subscribe time); only subsequent
    // advances represent a change after the review was cached.
    return service.queries.getGraphRevision.subscribe(undefined, ({ data: revision }) => {
      if (revision !== undefined && revision > 0) {
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

/**
 * Adapts legacy review channel events into the authoritative review service.
 *
 * `PUSH_REVIEW` remains for the unchanged production MCP implementation.
 * Dismissal events only relay tab-specific return navigation.
 */
export function initReviewChannel(channel: Channel, options: ReviewChannelOptions = {}) {
  const subscribeToModuleGraphChanges =
    options.subscribeToModuleGraphChanges ?? defaultSubscribeToModuleGraphChanges;
  const reviewService = getService<ReviewService>('core/review', { internal: true });

  const onPushReview = async (payload: ReviewState) => {
    try {
      await reviewService.commands.setReview(payload);
    } catch (error) {
      logger.warn(
        `Failed to apply PUSH_REVIEW payload to core/review: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const onDismissReview = (returnSearch?: string | null) => {
    channel.emit(REVIEW_EVENTS.REVIEW_DISMISSED, returnSearch ?? null);
  };

  channel.on(REVIEW_EVENTS.PUSH_REVIEW, onPushReview);
  channel.on(REVIEW_EVENTS.DISMISS_REVIEW, onDismissReview);

  // Grace window is enforced inside `markStale`; always forward graph changes.
  const unsubscribeFromModuleGraph = subscribeToModuleGraphChanges(() => {
    void reviewService.commands.markStale(undefined);
  });

  return () => {
    channel.off(REVIEW_EVENTS.PUSH_REVIEW, onPushReview);
    channel.off(REVIEW_EVENTS.DISMISS_REVIEW, onDismissReview);
    unsubscribeFromModuleGraph();
  };
}
