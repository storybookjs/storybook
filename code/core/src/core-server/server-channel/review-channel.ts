import type { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';

import { getService } from '../../shared/open-service/server.ts';
import type { ReviewService } from '../../shared/open-service/services/review/definition.ts';
import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import type { ReviewState } from '../../shared/review/review-state.ts';

/**
 * Adapts legacy review channel events into the authoritative review service.
 *
 * `PUSH_REVIEW` remains for the unchanged production MCP implementation; delete that adapter in
 * Milestone 4 when addon-mcp calls the review toolset directly. Dismissal events only relay
 * tab-specific return navigation.
 */
export function initReviewChannel(channel: Channel) {
  const reviewService = getService<ReviewService>('core/review', { internal: true });

  const onPushReview = async (payload: ReviewState) => {
    try {
      await reviewService.commands.setReview(payload);
    } catch (error) {
      logger.warn(
        `Failed to apply PUSH_REVIEW payload to the review service: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const onDismissReview = (returnSearch?: string | null) => {
    channel.emit(REVIEW_EVENTS.REVIEW_DISMISSED, returnSearch ?? null);
  };

  channel.on(REVIEW_EVENTS.PUSH_REVIEW, onPushReview);
  channel.on(REVIEW_EVENTS.DISMISS_REVIEW, onDismissReview);

  return () => {
    channel.off(REVIEW_EVENTS.PUSH_REVIEW, onPushReview);
    channel.off(REVIEW_EVENTS.DISMISS_REVIEW, onDismissReview);
  };
}
