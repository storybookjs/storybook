import type { JsPackageManager } from 'storybook/internal/common';
import type { SupportedRenderer } from 'storybook/internal/types';

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
  /** Whether the project's preview file uses the CSF Factory format. */
  hasCsfFactoryPreview: boolean;
  /** Whether the user has requested to be onboarded into Storybook. */
  needsUserOnboarding: boolean;
}

export interface SetupInstructionsContext {
  configDir: string;
  docsUrl: (path: string) => string;
  mswInstall: string;
  needsUserOnboarding: boolean;
  packageManager: JsPackageManager;
  packageManagerName: string | undefined;
  tsx: string;
  ts: string;
}
