/**
 * Core-owned namespace for the review ingest contract. The external
 * `@storybook/addon-mcp` producer must emit these same event names.
 */
export const REVIEW_NAMESPACE = 'storybook/review';

/**
 * Channel events exchanged between the MCP producer, core-server, and the manager. Review state
 * itself flows through the `core/review` open service; only ingest and telemetry stay on the
 * channel.
 */
export const REVIEW_EVENTS = {
  // `@storybook/addon-mcp` display-review tool → core-server: the raw agent payload.
  // Delete in Milestone 4: addon-mcp's display-review moves onto the review toolset
  // (`review.create`), removing this event's last producer and its channel adapter.
  PUSH_REVIEW: `${REVIEW_NAMESPACE}/push-review`,
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
