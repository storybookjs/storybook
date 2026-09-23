/**
 * Reader-side types for the runtime instance registry the dev server writes. The writer side lives
 * in `code/core/src/core-server/utils/runtime-instance-registry.ts`; this reader is intentionally
 * more lenient (extra statuses, optional fields) so it also accepts records written by older
 * Storybook versions and external wrappers.
 */
import * as v from 'valibot';

/**
 * The in-repo writer only emits `not-installed` and `ready`; `starting` and `error` may appear on
 * records from older writers / external wrappers and must keep being dispatched here.
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
  /**
   * Resolved config directory of the running Storybook, used as a second matching key so
   * monorepo instances are found from a different cwd (storybookjs/storybook#35359). Optional:
   * records written by Storybooks older than 10.5 lack it.
   */
  configDir: v.optional(v.string()),
  url: v.string(),
  port: v.pipe(v.number(), v.minValue(1), v.maxValue(65535), v.integer()),
  /**
   * Token authenticating clients against the instance's WebSocket channel. Optional: records
   * written by older Storybooks lack it.
   */
  token: v.optional(v.string()),
  agent: v.optional(v.string()),
  storybookVersion: v.optional(v.string()),
  /**
   * Realpathed root of the `storybook` package the dev server actually runs, recorded by the
   * server from its own module location. The caller attaches in-process when this equals its own
   * root, and spawns its child host from this root otherwise. Optional: records written by older
   * Storybooks lack it, which makes attach refuse.
   */
  storybookPath: v.optional(v.string()),
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
