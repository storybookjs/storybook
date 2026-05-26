export const MCP_APP_PARAM = 'mcp-app';
export const MCP_APP_SIZE_CHANGED_EVENT = 'storybook-mcp:size-changed';

/**
 * Channel events shared with `@storybook/addon-review` (cross-repo
 * contract). Keep in sync with that addon's `src/constants.ts`.
 */
export const APPLY_REVIEW_STATE_EVENT = 'storybook/addon-review/apply-review-state';
export const REQUEST_REVIEW_STATE_EVENT = 'storybook/addon-review/request-review-state';

/** Storybook manager route the review page is registered at. */
export const REVIEW_PAGE_PATH = '/review/';
