import type { ModuleGraphService } from '@storybook/core/internal/services';
import type { StoryIndex } from '@storybook/core/internal/types';
import { OpenServiceUnknownStoryIdsError } from '@storybook/core/internal/server-errors';
import {
  getService,
  registerService,
} from '@storybook/core/internal/deep/shared/open-service/server';
import {
  reviewServiceDef,
  type ReviewService,
} from '@storybook/core/internal/deep/shared/open-service/services/review/definition';
import {
  applyAcceptPending,
  applyDismiss,
  applyMarkStale,
  applyPublishedReview,
} from '@storybook/core/internal/deep/shared/open-service/services/review/state-transitions';

export interface RegisterReviewServiceOptions {
  getIndex: () => Promise<StoryIndex>;
}

/** Registers the stateful `core/review` service in the server realm. */
export function registerReviewService({ getIndex }: RegisterReviewServiceOptions): ReviewService {
  return registerService(reviewServiceDef, {
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
        handler: async (change, ctx) => {
          ctx.self.setState((state) => {
            applyMarkStale(state, change);
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

/** Marks reviews stale on module-graph changes; started with the dev server, never at registration. */
export function subscribeReviewToModuleGraphChanges(): void {
  const review = getService<ReviewService>('core/review', { internal: true });
  const moduleGraph = getService<ModuleGraphService>('core/module-graph', { internal: true });
  moduleGraph.queries.graphChangedAt.subscribe(undefined, ({ data: changedAt }) => {
    if (changedAt !== undefined) {
      void review.commands.markStale({ changedAt });
    }
  });
}
