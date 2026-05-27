export const MCP_APP_PARAM = 'mcp-app';
export const MCP_APP_SIZE_CHANGED_EVENT = 'storybook-mcp:size-changed';

/**
 * Channel event shared with `@storybook/addon-review` (cross-repo contract).
 * Emitted by the `display-review` tool to hand the agent's payload off to the
 * addon-review server preset
 */
export const PUSH_REVIEW_EVENT = 'storybook/addon-review/push-review';

/** Storybook manager route the review page is registered at. */
export const REVIEW_PAGE_PATH = '/review/';
