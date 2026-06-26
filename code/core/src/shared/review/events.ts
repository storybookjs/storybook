/**
 * Core-owned namespace for the review ingest contract. The external
 * `@storybook/addon-mcp` producer must emit these same event names.
 */
export const REVIEW_NAMESPACE = 'storybook/review';

/** Channel events exchanged between the MCP producer, core-server, and the manager. */
export const REVIEW_EVENTS = {
  // `@storybook/addon-mcp` display-review tool → core-server: the raw agent payload.
  PUSH_REVIEW: `${REVIEW_NAMESPACE}/push-review`,
  // core-server → tabs: display the (createdAt-stamped) review.
  DISPLAY_REVIEW: `${REVIEW_NAMESPACE}/display-review`,
  // tab → core-server: replay the cached review on mount.
  REQUEST_REVIEW: `${REVIEW_NAMESPACE}/request-review`,
  // core-server → tabs: a watched source file changed after the review was cached.
  REVIEW_STALE: `${REVIEW_NAMESPACE}/review-stale`,
  // tab → core-server: dismiss the cached review.
  DISMISS_REVIEW: `${REVIEW_NAMESPACE}/dismiss-review`,
  // core-server → tabs: the review was dismissed.
  REVIEW_DISMISSED: `${REVIEW_NAMESPACE}/review-dismissed`,
} as const;
