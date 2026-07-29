import type { StoryIndex } from 'storybook/internal/types';

import { OpenServiceUnknownStoryIdsError } from '../../../../server-errors.ts';
import type { ReviewState } from '../../../review/review-state.ts';
import { getService, registerService } from '../../server.ts';
import type { ModuleGraphService } from '../module-graph/definition.ts';
import { REVIEW_STALE_GRACE_MS, reviewServiceDef, type ReviewService } from './definition.ts';

type SubscribeToModuleGraphChanges = (onChange: () => void) => () => void;

/**
 * Default subscription to the `core/module-graph` open service. The review goes stale when any
 * file in the story module graph changes (the service's revision only advances for in-graph
 * changes, so unrelated file edits never trip it). The `services` preset registers the module
 * graph before the review service, so the lookup succeeds synchronously here; if it's unavailable
 * (e.g. a builder without module-graph support), staleness simply never triggers.
 */
const defaultSubscribeToModuleGraphChanges: SubscribeToModuleGraphChanges = (onChange) => {
  try {
    const service = getService<ModuleGraphService>('core/module-graph', { internal: true });
    // Omit the input to watch the entire graph. The initial emission carries revision 0 (or the
    // current revision at subscribe time); only subsequent advances represent a change after the
    // review was cached.
    return service.queries.graphRevision.subscribe(undefined, ({ data: revision }) => {
      if (revision !== undefined && revision > 0) {
        onChange();
      }
    });
  } catch {
    // Module graph unavailable (e.g. builder without support); no staleness.
    return () => {};
  }
};

export interface RegisterReviewServiceOptions {
  getIndex: () => Promise<StoryIndex>;
  /** Override the module-graph-change subscription. Used by tests. */
  subscribeToModuleGraphChanges?: SubscribeToModuleGraphChanges;
}

/**
 * Deep-copies a review read through the deepSignal state proxy into plain objects. Assigning
 * proxied values back into state would leave wrappers that `structuredClone` cannot snapshot
 * (the same constraint behind `markStale`'s in-place mutation).
 */
function toPlainReview(review: ReviewState): ReviewState {
  return {
    ...review,
    collections: review.collections.map((collection) => ({
      ...collection,
      storyIds: [...collection.storyIds],
    })),
    ...(review.changedFiles ? { changedFiles: [...review.changedFiles] } : {}),
  };
}

/** Registers the stateful `core/review` service in the server realm. */
export function registerReviewService({
  getIndex,
  subscribeToModuleGraphChanges = defaultSubscribeToModuleGraphChanges,
}: RegisterReviewServiceOptions): ReviewService {
  const service = registerService(reviewServiceDef, {
    commands: {
      setReview: {
        handler: async (input, ctx) => {
          const { stale: _stale, createdAt: _createdAt, ...review } = input;
          const storyIds = [
            ...new Set(review.collections.flatMap((collection) => collection.storyIds)),
          ];
          const index = await getIndex();
          const unknownIds = storyIds.filter((storyId) => !index.entries[storyId]);
          if (unknownIds.length > 0) {
            throw new OpenServiceUnknownStoryIdsError({ unknownIds });
          }

          ctx.self.setState((state) => {
            const stamped = { ...review, createdAt: Date.now() };
            // Defer while a review is current so an in-progress review isn't yanked; the latest
            // update wins over any previously held one.
            if (state.current === null) {
              state.current = stamped;
              state.pending = null;
            } else {
              state.pending = stamped;
            }
          });
        },
      },
      acceptPending: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            if (state.pending !== null) {
              state.current = toPlainReview(state.pending);
              state.pending = null;
            }
          });
        },
      },
      markStale: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            const current = state.current;
            if (
              current?.createdAt !== undefined &&
              !current.stale &&
              Date.now() >= current.createdAt + REVIEW_STALE_GRACE_MS
            ) {
              // Mutate in place: replacing `current` with a shallow copy leaves proxied
              // nested arrays that `structuredClone` cannot snapshot.
              current.stale = true;
            }
          });
        },
      },
      dismissReview: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            state.current = null;
            state.pending = null;
          });
        },
      },
    },
  });

  // The subscription is process-lifetime by design: the service registers once per dev-server
  // process and there is no teardown phase to return it to. The grace window is enforced inside
  // `markStale`, so graph changes are always forwarded.
  subscribeToModuleGraphChanges(() => {
    void service.commands.markStale(undefined);
  });

  return service;
}
