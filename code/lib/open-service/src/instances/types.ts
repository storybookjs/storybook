/**
 * Reader-side types for the runtime instance registry the dev server writes. The writer side lives
 * in `code/lib/storybook/src/storybook/server/utils/runtime-instance-registry.ts`; this reader is intentionally
 * more lenient (extra statuses, optional fields) so it also accepts records written by older
 * Storybook versions and external wrappers.
 */
import * as v from '@storybook/core/internal/deep/utils/valibot';

/**
 * The in-repo writer only emits `not-installed` and `ready`; `starting` and `error` may appear on
 * records from older writers / external wrappers and must keep parsing.
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
   * server from its own module location. A caller on a different core installation spawns its
   * child host from this root. Optional: records written by older Storybooks lack it.
   */
  storybookPath: v.optional(v.string()),
  /**
   * Realpathed root of the `@storybook/core` package the dev server runs: the installation identity
   * attach compares. Optional: older records lack it, and readers derive it from `storybookPath`.
   */
  corePath: v.optional(v.string()),
  /**
   * Toolset RPC protocol version the dev server serves. On a match the client runs toolsets on the
   * server and loads nothing itself. Optional: older records lack it and attach the older way.
   */
  toolsetRpc: v.optional(v.number()),
  startedAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
  mcp: v.object({
    status: McpStatusSchema,
    endpoint: v.optional(v.string()),
  }),
});
export type StorybookInstanceRecord = v.InferOutput<typeof StorybookInstanceRecordSchema>;
