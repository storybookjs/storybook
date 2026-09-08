export const MCP_APP_PARAM = 'mcp-app';
export const MCP_APP_SIZE_CHANGED_EVENT = 'storybook-mcp:size-changed';

/**
 * Request header Storybook's own CLIs (and the Claude/Codex plugins built on
 * them) send on every MCP request to mark themselves as a trusted local
 * Storybook client. Mirrors `STORYBOOK_MCP_PROXY_HEADER` in Storybook core's
 * `cli/tools/mcp-client.ts` — the two must stay in sync.
 */
export const STORYBOOK_MCP_PROXY_HEADER = 'X-Storybook-MCP-Proxy';

/**
 * Default path the MCP server is mounted at on the Storybook dev server.
 * The user can override this via the addon's `endpoint` option; everywhere
 * else in the codebase that needs to compare against or fall back to the
 * default should import this constant rather than hard-coding `'/mcp'`.
 */
export const DEFAULT_MCP_ENDPOINT = '/mcp';
