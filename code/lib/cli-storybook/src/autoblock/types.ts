import type { JsPackageManager, PackageJson } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

export interface AutoblockOptions {
  packageManager: JsPackageManager;
  packageJson: PackageJson;
  mainConfig: StorybookConfig;
  mainConfigPath: string;
  configDir: string;
}

export interface Blocker<T> {
  /**
   * A unique string to identify the blocker with.
   */
  id: string;
  /**
   * Check if the blocker should block.
   *
   * @param context
   * @returns A truthy value to activate the block, return false to proceed.
   */
  check: (options: AutoblockOptions) => Promise<T | false>;
  /**
   * Format a message to be printed to the log-file.
   * @param context
   * @param data returned from the check method.
   * @returns The string to print to the log-file.
   */
  log: (options: AutoblockOptions, data: T) => string;
}

export function createBlocker<T>(block: Blocker<T>) {
  return block;
}
