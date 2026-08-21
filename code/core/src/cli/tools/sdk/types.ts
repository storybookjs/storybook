import type {
  AnyToolsetOutcome,
  ToolsetTelemetry,
} from '../../../shared/open-service/toolset-definition.ts';
import type { ToolsetMethodId } from '../../../shared/open-service/toolset-names.ts';
import type { ToolsetJsonSchema } from './json-schema.ts';

/**
 * How the SDK hosts the target project's tools.
 *
 * `attached` talks to a running Storybook dev server, `local` loads the target configuration in
 * this process, and `auto` prefers the former and falls back to the latter.
 */
export type ToolsMode = 'auto' | 'attached' | 'local';

/** Identifies the surface calling the SDK, for the attach handshake and for telemetry. */
export type ToolsClientInfo = {
  name: string;
  version: string;
  /** Defaults to `sdk`; first-party surfaces stamp their own, as the `storybook tools` CLI does. */
  kind?: 'sdk' | 'cli';
};

export type CreateToolsOptions = {
  /** Project directory of the target Storybook; defaults to `process.cwd()`. */
  cwd?: string;
  /** Directory to load the Storybook configuration from; relative paths resolve from `cwd`. */
  configDir?: string;
  /** Defaults to `auto`. */
  mode?: ToolsMode;
  /** Whether the SDK may start a child host in the target project's own environment. */
  autoSpawn?: boolean;
  clientInfo?: ToolsClientInfo;
};

/** What the resolved host knows about the Storybook it serves. */
export type ToolsStorybookInfo = {
  version: string;
  configDir: string;
  /** Base URL of the running Storybook, including any deployment subpath. */
  url?: string;
  /** Process id of the running Storybook. */
  pid?: number;
};

/** One callable tool, described for an agent that has only this catalog to go on. */
export type ToolsetCatalogMethod = {
  /** Dotted `toolsetId.methodName`, as passed to {@link Tools.call}. */
  ref: ToolsetMethodId;
  title: string;
  description: string;
  requiresDevServer: boolean;
  /** `undefined` when the method's schema has no JSON Schema representation. */
  inputSchema: ToolsetJsonSchema | undefined;
  outputSchema?: ToolsetJsonSchema;
};

export type ToolsetCatalogEntry = {
  id: string;
  description: string;
  methods: ToolsetCatalogMethod[];
};

/** Every tool the target Storybook configuration registers. */
export type ToolsetCatalog = {
  configDir: string;
  toolsets: ToolsetCatalogEntry[];
};

export type ToolsDescribeOptions = {
  /** Restrict the catalog to one toolset id. */
  toolset?: string;
};

export type ToolsCallOptions = {
  signal?: AbortSignal;
  /** Storybook UI base URL for methods that need a live origin. */
  origin?: string;
  telemetry?: ToolsetTelemetry;
};

type ToolsBase = {
  clientInfo: Required<ToolsClientInfo>;
  storybook: ToolsStorybookInfo;
  describe(options?: ToolsDescribeOptions): Promise<ToolsetCatalog>;
  /**
   * Run one tool by its dotted `toolsetId.methodName` reference.
   *
   * A tool that ran and reported bad news resolves to an outcome with `ok: false`; only a fault
   * that stopped the tool from running rejects.
   *
   * @throws {ToolsRuntimeError} When the reference is unknown, the input fails the method's
   *   schema, or the host can no longer serve calls.
   * @throws {AttachUnavailableError} When the method needs a running Storybook the host has not
   *   attached to.
   */
  call(
    ref: string,
    input?: Record<string, unknown>,
    options?: ToolsCallOptions
  ): Promise<AnyToolsetOutcome>;
  close(): Promise<void>;
};

/** A host that loaded the target configuration in this process. */
export type LocalTools = ToolsBase & {
  mode: 'local';
};

export type AttachedTools = ToolsBase & {
  mode: 'attached';
};

export type Tools = LocalTools | AttachedTools;
