import type { JsPackageManager } from 'storybook/internal/common';
import type { SupportedRenderer } from 'storybook/internal/types';

export interface AiSetupOptions {
  configDir?: string;
  packageManager?: string;
  output?: string;
  /** Populated from the program-level `--disable-telemetry` flag (defaults from `STORYBOOK_DISABLE_TELEMETRY`). */
  disableTelemetry?: boolean;
}

export interface ProjectInfo {
  storybookVersion: string | undefined;
  majorVersion: number | undefined;
  framework: string | null;
  /** The full renderer package name, e.g. "@storybook/react" */
  rendererPackage: string | null;
  /** The short renderer name for docs URLs, e.g. "react" */
  renderer?: SupportedRenderer;
  builderPackage: string | null;
  addons: string[];
  configDir: string;
  storiesPaths: string[];
  /** Whether the project uses TypeScript ('ts') or JavaScript ('js'), inferred from the main config file extension. */
  language: 'ts' | 'js';
  /** Detected package manager (npm, yarn, pnpm, bun), if known. */
  packageManager: JsPackageManager;
  /** Pretty name of the detected package manager, if known. */
  packageManagerName?: string;
}

/**
 * Represents a skill category that can be expanded in the future.
 * Each skill provides a name, description, and instructions for agents.
 */
export interface AiPrompt {
  name: string;
  description: string;
  instructions: string;
}
