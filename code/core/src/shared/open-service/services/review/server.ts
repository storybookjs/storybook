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

export interface RegisterReviewServiceOptions {
  getIndex: () => Promise<StoryIndex>;
}

/** Registers the stateful `core/review` service in the server realm. */
export function registerReviewService({ getIndex }: RegisterReviewServiceOptions): ReviewService {
  return registerService(reviewServiceDef, {
    commands: {
      setReview: {
        handler: async (input, ctx) => {
          const { stale: _stale, createdAt: _createdAt, revision: _revision, ...review } = input;
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

          // The agent's own edits land before it publishes, so settling folds them into the
          // review's revision instead of letting them mark it stale.
          const moduleGraph = ctx.getService<ModuleGraphService>('core/module-graph', {
            internal: true,
          });
          await moduleGraph.commands._waitForSettledEngine(undefined);
          const revision = moduleGraph.queries.graphRevision.get(undefined);

          ctx.self.setState((state) => {
            applyPublishedReview(state, { ...review, createdAt: Date.now(), revision });
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
        handler: async ({ revision }, ctx) => {
          ctx.self.setState((state) => {
            applyMarkStale(state, revision);
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
}

export function subscribeReviewToModuleGraphChanges(): void {
  const review = getService<ReviewService>('core/review', { internal: true });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  moduleGraph.queries.graphRevision.subscribe(undefined, ({ data: revision }) => {
    if (revision !== undefined) {
      void review.commands.markStale({ revision });
    }
  });
}
