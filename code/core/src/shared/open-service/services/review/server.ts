import type { StoryIndex } from 'storybook/internal/types';

import { OpenServiceUnknownStoryIdsError } from '../../../../server-errors.ts';
import { registerService } from '../../server.ts';
import { REVIEW_STALE_GRACE_MS, reviewServiceDef } from './definition.ts';

/** Registers the stateful `core/review` service in the server realm. */
export function registerReviewService({ getIndex }: { getIndex: () => Promise<StoryIndex> }) {
  return registerService(reviewServiceDef, {
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
            state.current = { ...review, createdAt: Date.now() };
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
              state.current = {
                ...current,
                collections: current.collections.map((collection) => ({
                  ...collection,
                  storyIds: [...collection.storyIds],
                })),
                ...(current.changedFiles ? { changedFiles: [...current.changedFiles] } : {}),
                stale: true,
              };
            }
          });
        },
      },
      dismissReview: {
        handler: async (_input, ctx) => {
          ctx.self.setState((state) => {
            state.current = null;
          });
        },
      },
    },
  });
}
