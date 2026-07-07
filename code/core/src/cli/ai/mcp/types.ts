/**
 * Reader-side types for the `storybook ai <tool>` MCP passthrough, copied from
 * `@storybook/mcp-proxy` (storybookjs/mcp) per storybookjs/storybook#35124. The
 * writer side lives in `code/core/src/core-server/utils/runtime-instance-registry.ts`;
 * this reader is intentionally more lenient (extra statuses, optional fields) so it
 * also accepts records written by other Storybook versions and wrappers.
 */
import * as v from 'valibot';

/**
 * The in-repo writer only emits `not-installed` and `ready`; `starting` and `error` are written by
 * external wrappers (e.g. the storybookjs/mcp launch script) and must keep being dispatched here.
 */
export const McpStatusSchema = v.picklist(['not-installed', 'starting', 'ready', 'error']);
export type McpStatus = v.InferOutput<typeof McpStatusSchema>;

/**
 * A single Storybook runtime record written under the registry dir (default
 * `~/.storybook/instances`). One file per running `storybook dev` instance.
 * Spec: storybookjs/storybook#34826.
 */
export const StorybookInstanceRecordSchema = v.object({
  schemaVersion: v.literal(1),
  instanceId: v.string(),
  pid: v.pipe(v.number(), v.minValue(1), v.integer()),
  cwd: v.string(),
  url: v.string(),
  port: v.pipe(v.number(), v.minValue(1), v.maxValue(65535), v.integer()),
  agent: v.optional(v.string()),
  storybookVersion: v.optional(v.string()),
  startedAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
  mcp: v.object({
    status: McpStatusSchema,
    endpoint: v.optional(v.string()),
  }),
});
export type StorybookInstanceRecord = v.InferOutput<typeof StorybookInstanceRecordSchema>;

export type InterceptReason =
  | 'no-instance'
  | 'port-mismatch'
  | 'addon-missing'
  | 'mcp-starting'
  | 'mcp-error';

/**
 * Result of an MCP `tools/call` request, as returned by `@storybook/addon-mcp`. Loose: servers may
 * legally attach extra fields (`_meta`, `structuredContent`, image/audio content properties); we
 * validate only what the CLI renders and pass the rest through.
 */
export const ToolResultContentItemSchema = v.looseObject({
  type: v.string(),
  text: v.optional(v.string()),
});
export type ToolResultContentItem = v.InferOutput<typeof ToolResultContentItemSchema>;

export const ToolCallResultSchema = v.looseObject({
  content: v.optional(v.array(ToolResultContentItemSchema)),
  isError: v.optional(v.boolean()),
});
export type ToolCallResult = v.InferOutput<typeof ToolCallResultSchema>;

/** A tool descriptor from an MCP `tools/list` response. */
export const McpToolDescriptorSchema = v.looseObject({
  name: v.string(),
  description: v.optional(v.string()),
  inputSchema: v.optional(
    v.looseObject({
      properties: v.optional(
        v.record(
          v.string(),
          v.looseObject({
            type: v.optional(v.string()),
            description: v.optional(v.string()),
          })
        )
      ),
      required: v.optional(v.array(v.string())),
    })
  ),
});
export type McpToolDescriptor = v.InferOutput<typeof McpToolDescriptorSchema>;
