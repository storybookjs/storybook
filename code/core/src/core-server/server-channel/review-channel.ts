import type { Channel } from 'storybook/internal/channels';
import { logger } from 'storybook/internal/node-logger';

import { getService } from '../../shared/open-service/server.ts';
import type { ReviewService } from '../../shared/open-service/services/review/definition.ts';
import { REVIEW_EVENTS } from '../../shared/review/events.ts';
import type { ReviewState } from '../../shared/review/review-state.ts';

/**
 * Adapts the legacy review ingest channel event into the authoritative review service.
 *
 * `PUSH_REVIEW` remains for the unchanged production MCP implementation; delete this adapter in
 * Milestone 4 when addon-mcp calls the review toolset directly.
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

  channel.on(REVIEW_EVENTS.PUSH_REVIEW, onPushReview);

  return () => {
    channel.off(REVIEW_EVENTS.PUSH_REVIEW, onPushReview);
  };
}
