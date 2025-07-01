import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

export interface AutoblockOptions {
  packageManager: JsPackageManager;
  mainConfig: StorybookConfig;
  mainConfigPath: string;
  configDir: string;
}

export type BlockerCheckResult<T> = T | false;

export type BlockerModule<T> = Promise<{ blocker: Blocker<T> }>;

export type AutoblockerResult<T> = {
  result: BlockerCheckResult<T>;
  blocker: Blocker<T>;
};

export interface Blocker<T> {
  /** A unique string to identify the blocker with. */
  id: string;
  /**
   * Check if the blocker should block.
   *
   * @param context
   * @returns A truthy value to activate the block, return false to proceed.
   */
  check: (options: AutoblockOptions) => Promise<BlockerCheckResult<T>>;
  /**
   * Format a message to be printed to the log-file.
   *
   * @param context
   * @param data Returned from the check method.
   * @returns The string to print to the log-file.
   */
  log: (data: T) => {
    /** The title of the blocker. */
    title: string;
    /** The message of the blocker. */
    message: string;
    /** A link to the documentation for the blocker. */
    link?: string;
  };
}

export function createBlocker<T>(block: Blocker<T>) {
  return block;
}
