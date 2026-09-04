export interface AiSetupOptions {
  /** Location of the Storybook configuration directory. */
  configDir?: string;

  /** Package manager to use (npm, yarn1, yarn2, pnpm, bun). */
  packageManager?: string;

  /** If provided, the generated instructions and code will be written to this file instead of the console. */
  output?: string;

  /** Populated from the program-level `--disable-telemetry` flag (defaults from `STORYBOOK_DISABLE_TELEMETRY`). */
  disableTelemetry?: boolean;

  /** A random ID attributed by the CLI when running `ai setup` to identify the setup session. */
  runId: string;
}

// Re-exported so `cli/ai/mcp/` importers keep compiling.
export type { ProjectInfo } from '../skills/project-info.ts';
