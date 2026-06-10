/**
 * Reader-side types for the `storybook ai <tool>` MCP passthrough, copied from
 * `@storybook/mcp-proxy` (storybookjs/mcp) per storybookjs/storybook#35124. The
 * writer side lives in `code/core/src/core-server/utils/runtime-instance-registry.ts`;
 * this reader is intentionally more lenient (extra statuses, optional fields) so it
 * also accepts records written by other Storybook versions and wrappers.
 */

/**
 * The in-repo writer only emits `not-installed` and `ready`; `starting` and `error` are written by
 * external wrappers (e.g. the storybookjs/mcp launch script) and must keep being dispatched here.
 */
export type McpStatus = 'not-installed' | 'starting' | 'ready' | 'error';

/**
 * A single Storybook runtime record written under the registry dir (default
 * `~/.storybook/instances`). One file per running `storybook dev` instance.
 * Spec: storybookjs/storybook#34826.
 */
export interface StorybookInstanceRecord {
  schemaVersion: 1;
  instanceId: string;
  pid: number;
  cwd: string;
  url: string;
  port: number;
  storybookVersion?: string;
  startedAt?: string;
  updatedAt?: string;
  mcp: {
    status: McpStatus;
    endpoint?: string;
  };
}

export type InterceptReason =
  | 'no-instance'
  | 'storybook-not-installed'
  | 'addon-missing'
  | 'mcp-starting'
  | 'mcp-error'
  | 'storybook-too-old';

export interface ToolResultContentItem {
  type: string;
  text?: string;
  [key: string]: unknown;
}

/** Result of an MCP `tools/call` request, as returned by `@storybook/addon-mcp`. */
export interface ToolCallResult {
  content?: ToolResultContentItem[];
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/** A tool descriptor from an MCP `tools/list` response. */
export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}
