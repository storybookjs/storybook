import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

export interface CheckOptions {
  packageManager: JsPackageManager;
  rendererPackage?: string;
  configDir?: string;
  mainConfig: StorybookConfigRaw;
  storybookVersion: string;
  previewConfigPath?: string;
  mainConfigPath?: string;
}

export interface RunOptions<ResultType> {
  packageManager: JsPackageManager;
  result: ResultType;
  dryRun?: boolean;
  mainConfigPath: string;
  skipInstall?: boolean;
}

/**
 * PromptType defines how the user will be prompted to apply an automigration fix
 *
 * - Auto: the fix will be applied automatically
 * - Manual: the user will be prompted to apply the fix
 * - Notification: the user will be notified about some changes. A fix isn't required, though
 */
export type Prompt = 'auto' | 'manual' | 'notification';

type BaseFix<ResultType = any> = {
  id: string;
  /**
   * The from/to version range of Storybook that this fix applies to. The strings are semver ranges.
   * The versionRange will only be checked if the automigration is part of an upgrade. If the
   * automigration is not part of an upgrade but rather called via `automigrate` CLI, the check
   * function should handle the version check.
   */
  versionRange: [from: string, to: string];
  check: (options: CheckOptions) => Promise<ResultType | null>;
  prompt: (result: ResultType) => string;
  promptDefaultValue?: boolean;
};

type PromptType<ResultType = any, T = Prompt> =
  | T
  | ((result: ResultType) => Promise<Prompt> | Prompt);

export type Fix<ResultType = any> = (
  | {
      promptType?: PromptType<ResultType, 'auto'>;
      run: (options: RunOptions<ResultType>) => Promise<void>;
    }
  | {
      promptType: PromptType<ResultType, 'manual' | 'notification'>;
      run?: never;
    }
) &
  BaseFix<ResultType>;

export type FixId = string;

export enum PreCheckFailure {
  UNDETECTED_SB_VERSION = 'undetected_sb_version',
  MAINJS_NOT_FOUND = 'mainjs_not_found',
  MAINJS_EVALUATION = 'mainjs_evaluation_error',
}

export interface AutofixOptions extends Omit<AutofixOptionsFromCLI, 'packageManager'> {
  packageManager: JsPackageManager;
  mainConfigPath: string;
  /** The version of Storybook before the migration. */
  beforeVersion: string;
  storybookVersion: string;
  /** Whether the migration is part of an upgrade. */
  isUpgrade: boolean;
  isLatest: boolean;
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
