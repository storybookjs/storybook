export const MCP_APP_PARAM = 'mcp-app';
export const MCP_APP_SIZE_CHANGED_EVENT = 'storybook-mcp:size-changed';

/**
 * Channel event shared with Storybook core's review subsystem
 * Emitted by the `display-review` tool to hand the agent's payload off to the
 * core-server review channel.
 */
export const PUSH_REVIEW_EVENT = 'storybook/review/push-review';

/** Storybook manager route the review page is registered at. */
export const REVIEW_PAGE_PATH = '/review/';

/**
 * Default path the MCP server is mounted at on the Storybook dev server.
 * The user can override this via the addon's `endpoint` option; everywhere
 * else in the codebase that needs to compare against or fall back to the
 * default should import this constant rather than hard-coding `'/mcp'`.
 */
export const DEFAULT_MCP_ENDPOINT = '/mcp';
