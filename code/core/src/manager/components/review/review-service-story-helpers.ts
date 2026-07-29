import { registerService } from 'storybook/manager-api';

import { reviewServiceDef } from '../../../shared/open-service/services/review/definition.ts';
import type { ReviewState } from './review-state.ts';

/**
 * Deep-copies a review read through the state proxy into plain objects, so assignments never leave
 * proxied nested arrays behind (they would break `structuredClone` snapshots).
 */
const toPlainReview = (review: ReviewState): ReviewState => ({
  ...review,
  collections: review.collections.map((collection) => ({
    ...collection,
    storyIds: [...collection.storyIds],
  })),
  ...(review.changedFiles ? { changedFiles: [...review.changedFiles] } : {}),
});

/**
 * Story-only local handlers for exercising review-service projection without a dev-server peer.
 * Mirrors the server semantics (defer while current, promote on accept); production manager
 * registration intentionally supplies no command handlers.
 */
export const reviewServiceForStories = registerService(reviewServiceDef, {
  commands: {
    setReview: {
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          if (state.current === null) {
            state.current = input;
            state.pending = null;
          } else {
            state.pending = input;
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
          if (current) {
            state.current = { ...toPlainReview(current), stale: true };
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
