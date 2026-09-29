import { registerService } from 'storybook/manager-api';

import { reviewServiceDef } from '../../../shared/open-service/services/review/definition.ts';
import {
  applyAcceptPending,
  applyDismiss,
  applyMarkStale,
  applyPublishedReview,
} from '../../../shared/open-service/services/review/state-transitions.ts';

/**
 * Story-only local handlers for exercising review-service projection without a dev-server peer.
 * Runs the same shared state transitions as the server registration (so the double cannot drift),
 * minus story-id validation and `createdAt` stamping — stories control both. Production manager
 * registration intentionally supplies no command handlers.
 */
export const reviewServiceForStories = registerService(reviewServiceDef, {
  commands: {
    setReview: {
      handler: async (input, ctx) => {
        ctx.self.setState((state) => {
          applyPublishedReview(state, input);
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
