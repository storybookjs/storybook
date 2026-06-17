export const ADDON_ID = 'storybook/addon-review';
export const PAGE_ID = `${ADDON_ID}/page`;
export const REVIEW_CHANGES_URL = '/review/';

// Dev-server route (declared in preset.ts) that proxies the deployed baseline
// Storybook. Shared contract between the server-side proxy and the client-side
// baseline iframes / index fetch — keep all consumers pointed at this constant.
export const BASELINE_PROXY_PATH = '/__review-baseline';
// The baseline Storybook's index, used to detect stories absent from the
// baseline. Derived from the proxy path so the route stays single-sourced.
export const BASELINE_INDEX_URL = `${BASELINE_PROXY_PATH}/index.json`;

// sessionStorage key for the canvas search to return to when leaving review
// mode (both summary back-to-Storybook and dismiss). Captured while browsing
// stories/docs outside review mode, so it points at the pre-review canvas.
export const PRE_REVIEW_RETURN_KEY = `${ADDON_ID}/pre-review-return`;

// sessionStorage marker deduplicating the one-time auto-enter on first landing
// on the review summary. Reset on dismiss and when a new review payload arrives.
export const AUTO_ENTERED_SESSION_KEY = `${ADDON_ID}/auto-entered`;

// sessionStorage key remembering the compare mode for the tab session.
// Value: 'latest' | 'baseline' | 'split' (legacy '1up'/'2up' are migrated on read).
export const PREVIEW_MODE_SESSION_KEY = `${ADDON_ID}/preview-mode`;

export type CompareMode = 'latest' | 'baseline' | 'split';

export const DEFAULT_COMPARE_MODE: CompareMode = 'latest';

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
