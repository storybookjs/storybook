import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { FixFiles } from './fix-files.ts';

export interface CheckOptions {
  packageManager: JsPackageManager;
  rendererPackage?: string;
  configDir?: string;
  mainConfig: StorybookConfigRaw;
  storybookVersion: string;
  /** Version installed before the upgrade. Only set when running as part of `storybook upgrade`. */
  beforeVersion?: string;
  /** Whether this check runs as part of `storybook upgrade`. */
  isUpgrade?: boolean;
  /**
   * The user named this fix explicitly (`storybook automigrate <fixId>` or `storybook upgrade
   * --features <flag>`). Opt-in fixes may treat this as consent and skip their own gating.
   */
  requested?: boolean;
  previewConfigPath?: string;
  mainConfigPath?: string;
  storiesPaths: string[];
  hasCsfFactoryPreview: boolean;
  /** Scratch file edits: a check may stage them to learn whether `run` would change anything. */
  files: FixFiles;
}

export interface RunOptions<ResultType> {
  packageManager: JsPackageManager;
  result: ResultType;
  /** File edits the runner writes once `run` resolves, and discards when it throws. */
  files: FixFiles;
  mainConfigPath: string;
  previewConfigPath?: string;
  mainConfig: StorybookConfigRaw;
  configDir: string;
  skipInstall?: boolean;
  storybookVersion: string;
  storiesPaths: string[];
  /** Skip prompts and use defaults (from --yes flag) */
  yes?: boolean;
  /**
   * Collector for core addons whose postinstall configuration must run AFTER dependencies are
   * installed. A fix that adds a core addon via `add(..., { skipPostinstall: true })` pushes the
   * addon name here; the runner configures them once `installDependencies` has completed, mirroring
   * CLI init's install-then-configure ordering. Deferral is required because an addon's postinstall
   * hook can only be resolved once the package is on disk, and automigrate batches installs to the
   * end of the run.
   */
  addonsToPostinstall?: string[];
}

/**
 * PromptType defines how the user will be prompted to apply an automigration fix
 *
 * - Auto: the fix will be applied automatically
 * - Manual: the user will be prompted to apply the fix
 * - Notification: the user will be notified about some changes. A fix isn't required, though
 * - Command: the fix will only be applied when specified directly by its id
 */
export type Prompt = 'auto' | 'manual' | 'notification' | 'command';

type BaseFix<ResultType = any> = {
  id: string;
  check: (options: CheckOptions) => Promise<ResultType | null>;
  /** Keep the prompt message short and concise. */
  prompt: () => string;
  /** Whether the automigration is selected by default when the user is prompted. */
  defaultSelected?: boolean;
  link?: string;
};

type PromptType<ResultType = any, T = Prompt> =
  | T
  | ((result: ResultType) => Promise<Prompt> | Prompt);

export type Fix<ResultType = any> =
  | ({
      promptType?: PromptType<ResultType, 'auto'>;
      run: (options: RunOptions<ResultType>) => Promise<void>;
    } & BaseFix<ResultType>)
  | ({
      promptType: PromptType<ResultType, 'manual' | 'notification'>;
      run?: never;
    } & BaseFix<ResultType>);

export type CommandFixRunOptions = Omit<RunOptions<null>, 'files' | 'addonsToPostinstall'> & {
  dryRun?: boolean;
  /** Glob pattern for story files (for csf-factories codemod) */
  glob?: string;
};

export type CommandFix = {
  promptType: 'command';
  run: (options: CommandFixRunOptions) => Promise<void>;
} & Omit<BaseFix, 'check' | 'prompt'>;

export type FixId = string;

export enum PreCheckFailure {
  UNDETECTED_SB_VERSION = 'undetected_sb_version',
  MAINJS_NOT_FOUND = 'mainjs_not_found',
  MAINJS_EVALUATION = 'mainjs_evaluation_error',
}

export interface AutofixOptions extends Omit<AutofixOptionsFromCLI, 'packageManager'> {
  packageManager: JsPackageManager;
  mainConfigPath: string;
  previewConfigPath?: string;
  mainConfig: StorybookConfigRaw;
  storybookVersion: string;
  /** Version installed before the upgrade. Only set when running as part of `storybook upgrade`. */
  beforeVersion?: string;
  /** Whether the migration is part of an upgrade. */
  isUpgrade: boolean;
  isLatest: boolean;
  storiesPaths: string[];
  hasCsfFactoryPreview: boolean;
}
export interface AutofixOptionsFromCLI {
  fixId?: FixId;
  list?: boolean;
  fixes?: Fix[];
  yes?: boolean;
  packageManager?: PackageManagerName;
  dryRun?: boolean;
  configDir: string;
  renderer?: string;
  skipInstall?: boolean;
  hideMigrationSummary?: boolean;
  skipDoctor?: boolean;
  /** Glob pattern for story files (for csf-factories codemod) */
  glob?: string;
}

export enum FixStatus {
  CHECK_FAILED = 'check_failed',
  UNNECESSARY = 'unnecessary',
  MANUAL_SUCCEEDED = 'manual_succeeded',
  MANUAL_SKIPPED = 'manual_skipped',
  SKIPPED = 'skipped',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

export type FixSummary = {
  skipped: FixId[];
  manual: FixId[];
  succeeded: FixId[];
  failed: Record<FixId, string>;
};
