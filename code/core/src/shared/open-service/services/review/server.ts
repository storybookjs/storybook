import type { StoryIndex } from 'storybook/internal/types';

import { OpenServiceUnknownStoryIdsError } from '../../../../server-errors.ts';
import { getService, registerService } from '../../server.ts';
import type { ModuleGraphService } from '../module-graph/definition.ts';
import { reviewServiceDef, type ReviewService } from './definition.ts';
import {
  applyAcceptPending,
  applyDismiss,
  applyMarkStale,
  applyPublishedReview,
} from './state-transitions.ts';

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
          // Docs entries share the index but cannot be review slots: navigation and
          // previews resolve review entries as stories.
          const unknownIds = storyIds.filter((storyId) => index.entries[storyId]?.type !== 'story');
          if (unknownIds.length > 0) {
            throw new OpenServiceUnknownStoryIdsError({ unknownIds });
          }

          ctx.self.setState((state) => {
            applyPublishedReview(state, { ...review, createdAt: Date.now() });
          });
        },
      },
      acceptPending: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            applyAcceptPending(state);
          });
        },
      },
      markStale: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            applyMarkStale(state, Date.now());
          });
        },
      },
      dismissReview: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            applyDismiss(state);
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
