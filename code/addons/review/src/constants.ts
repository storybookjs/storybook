export const ADDON_ID = 'storybook/addon-review';
export const PAGE_ID = `${ADDON_ID}/page`;
export const REVIEW_CHANGES_URL = '/review/';

// sessionStorage key recording whether the manager sidebar (hidden while the
// review page is open) should be restored when the user leaves. Survives the
// full-reload navigations between review screens. Value: 'restore' | 'keep'.
export const RESTORE_NAV_SESSION_KEY = `${ADDON_ID}/restore-nav`;

// Addon-state key remembering the last selected preview mode in the details
// screen. Persisted to localStorage via useAddonState's 'permanent' option so
// it survives across sessions. Value: '1up' | '2up'.
export const PREVIEW_MODE_STATE_KEY = `${ADDON_ID}/preview-mode`;

// `@storybook/addon-mcp` display-review tool call emits this event with the raw agent payload.
const PUSH_REVIEW = `${ADDON_ID}/push-review`;
// Display agent review in the UI
const DISPLAY_REVIEW = `${ADDON_ID}/display-review`;
// Requests for the cached state of the agent review
const REQUEST_REVIEW = `${ADDON_ID}/request-review`;

export const EVENTS = {
  PUSH_REVIEW,
  DISPLAY_REVIEW,
  REQUEST_REVIEW,
};
