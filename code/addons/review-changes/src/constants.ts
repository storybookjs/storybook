export const ADDON_ID = 'storybook/addon-review-changes';
export const PAGE_ID = `${ADDON_ID}/page`;
export const REVIEW_CHANGES_URL = '/review-changes/';

// Cross-repo channel contract with `@storybook/addon-mcp`. These string
// values MUST match the emitter's constants exactly for the pipe to work.
const APPLY_REVIEW_STATE = `${ADDON_ID}/apply-review-state`;
const REQUEST_REVIEW_STATE = `${ADDON_ID}/request-review-state`;

export const EVENTS = {
  APPLY_REVIEW_STATE,
  REQUEST_REVIEW_STATE,
};
