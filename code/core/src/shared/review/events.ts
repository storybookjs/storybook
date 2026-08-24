/** Core-owned namespace for review channel events. */
export const REVIEW_NAMESPACE = 'storybook/review';

/**
 * Channel events between the review tabs and core-server. Review state itself flows through the
 * `core/review` open service; only telemetry stays on the channel.
 */
export const REVIEW_EVENTS = {
  // tab → core-server: a review page (summary or detail) was viewed; forwarded to telemetry.
  PAGEVIEW: `${REVIEW_NAMESPACE}/pageview`,
} as const;

/** Page identifiers reported by the `PAGEVIEW` event. */
export type ReviewPage = 'summary' | 'detail';

/** Payload of the `PAGEVIEW` event. */
export interface ReviewPageviewPayload {
  /** Which review surface was viewed. */
  page: ReviewPage;
  /** The viewed review's server `createdAt`, correlating pageviews to a review. */
  reviewCreatedAt?: number;
}
