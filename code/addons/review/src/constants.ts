// Core-owned namespace for the review ingest contract: channel events, session
// keys, status type id, and page/route ids all live under `storybook/review/*`.
// The external `@storybook/addon-mcp` producer must emit the same namespace.
export const ADDON_ID = 'storybook/review';
export const PAGE_ID = `${ADDON_ID}/page`;
export const REVIEW_CHANGES_URL = '/review/';

// sessionStorage key for the canvas search to return to when leaving review
// mode (both summary back-to-Storybook and dismiss). Captured while browsing
// stories/docs outside review mode, so it points at the pre-review canvas.
export const PRE_REVIEW_RETURN_KEY = `${ADDON_ID}/pre-review-return`;

// sessionStorage marker deduplicating the one-time auto-enter on first landing
// on the review summary. Reset on dismiss and when a new review payload arrives.
export const AUTO_ENTERED_SESSION_KEY = `${ADDON_ID}/auto-entered`;

// `@storybook/addon-mcp` display-review tool call emits this event with the raw agent payload.
const PUSH_REVIEW = `${ADDON_ID}/push-review`;
// Display agent review in the UI
const DISPLAY_REVIEW = `${ADDON_ID}/display-review`;
// Requests for the cached state of the agent review
const REQUEST_REVIEW = `${ADDON_ID}/request-review`;
// Server signals that a source file changed after the cached review was created,
// so the open review page should surface a "may be stale" banner.
const REVIEW_STALE = `${ADDON_ID}/review-stale`;
const DISMISS_REVIEW = `${ADDON_ID}/dismiss-review`;
const REVIEW_DISMISSED = `${ADDON_ID}/review-dismissed`;

export const EVENTS = {
  PUSH_REVIEW,
  DISPLAY_REVIEW,
  REQUEST_REVIEW,
  REVIEW_STALE,
  DISMISS_REVIEW,
  REVIEW_DISMISSED,
};
