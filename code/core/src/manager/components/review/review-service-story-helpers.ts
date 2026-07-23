import { registerService } from 'storybook/manager-api';

import { reviewServiceDef } from '../../../shared/open-service/services/review/definition.ts';

/**
 * Story-only local handlers for exercising OSA projection without a dev-server peer.
 * Production manager registration intentionally supplies no command handlers.
 */
export const reviewServiceForStories = registerService(reviewServiceDef, {
  commands: {
    setReview: {
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          state.current = input;
        });
      },
    },
    markStale: {
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          const current = state.current;
          if (current) {
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
