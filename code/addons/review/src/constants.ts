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

// sessionStorage key recording whether the manager sidebar (hidden while the
// review page is open) should be restored when the user leaves. Survives the
// full-reload navigations between review screens. Value: 'restore' | 'keep'.
export const RESTORE_NAV_SESSION_KEY = `${ADDON_ID}/restore-nav`;

// sessionStorage key for the canvas URL to restore when the user dismisses a
// review. Updated while browsing stories/docs outside a review session.
export const RETURN_PATH_SESSION_KEY = `${ADDON_ID}/return-path`;

// sessionStorage key for the last review story href visited before opening the
// summary overlay. Used by the summary header back button.
export const LAST_REVIEWED_STORY_SESSION_KEY = `${ADDON_ID}/last-reviewed-story`;

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
