import type { AddOptions } from '../../../lib/cli-storybook/src/add';
import type { AutofixOptionsFromCLI } from '../../../lib/cli-storybook/src/automigrate/fixes';
import type { FixesIDs, allFixes } from '../../../lib/cli-storybook/src/automigrate/fixes';
import type { DoctorOptions } from '../../../lib/cli-storybook/src/doctor';
import { JsPackageManagerFactory } from '../common';
import type { RemoveAddonOptions } from '../common/utils/remove';

// Common options shared across multiple commands
interface CommonOptions {
  packageManager?: 'npm' | 'pnpm' | 'yarn1' | 'yarn2' | 'bun';
  cwd?: string;
}

/**
 * Execute a Storybook CLI command
 *
 * @private
 * @param args The command arguments to pass to Storybook CLI
 * @returns A promise that resolves when the command completes
 */
const executeCommand = async (args: string[], options: CommonOptions = {}) => {
  const { packageManager: pkgMgr } = options;

  const packageManager = JsPackageManagerFactory.getPackageManager({ force: pkgMgr }, options.cwd);
  await packageManager.runPackageCommand('storybook', args, options.cwd, 'inherit');
};

/**
 * Run the 'add' command to add an addon to Storybook
 *
 * @example
 *
 * ```ts
 * await runAdd('@storybook/addon-a11y', {
 *   yes: true,
 *   configDir: 'config',
 *   packageManager: 'npm',
 * });
 * ```
 */
export const runAdd = async (addonName: string, options: AddOptions = {}) => {
  const args = ['add', addonName];

  if (options.yes) {
    args.push('--yes');
  }

  if (options.configDir) {
    args.push('--config-dir', options.configDir);
  }

  if (options.packageManager) {
    args.push('--package-manager', options.packageManager);
  }

  if (options.skipPostinstall) {
    args.push('--skip-postinstall');
  }

  return executeCommand(args);
};

/**
 * Run the 'remove' command to remove an addon from Storybook
 *
 * @example
 *
 * ```ts
 * await runRemove('@storybook/addon-a11y', {
 *   configDir: 'config',
 *   packageManager: 'npm',
 * });
 * ```
 */
export const runRemove = async (addonName: string, options: RemoveAddonOptions = {}) => {
  const args = ['remove', addonName];

  if (options.configDir) {
    args.push('--config-dir', options.configDir);
  }

  if (options.packageManager) {
    args.push('--package-manager', options.packageManager);
  }

  if (options.cwd) {
    args.push('--cwd', options.cwd);
  }

  return executeCommand(args);
};

/**
 * Run the 'automigrate' command to check and fix incompatibilities
 *
 * @example
 *
 * ```ts
 * await runAutomigrate('addon-a11y-parameters', {
 *   yes: true,
 *   configDir: 'config',
 *   packageManager: 'npm',
 * });
 * ```
 */
export const runAutomigrate = async (
  fixId?: FixesIDs<typeof allFixes>,
  options: AutofixOptionsFromCLI = {}
) => {
  const args = ['automigrate'];

  if (fixId) {
    args.push(fixId);
  }

  if (options.yes) {
    args.push('--yes');
  }

  if (options.dryRun) {
    args.push('--dry-run');
  }

  if (options.configDir) {
    args.push('--config-dir', options.configDir);
  }

  if (options.packageManager) {
    args.push('--package-manager', options.packageManager);
  }

  if (options.list) {
    args.push('--list');
  }

  if (options.skipInstall) {
    args.push('--skip-install');
  }

  if (options.renderer) {
    args.push('--renderer', options.renderer);
  }

  return executeCommand(args);
};

/**
 * Run the 'doctor' command to check for problems and get suggestions
 *
 * @example
 *
 * ```ts
 * await runDoctor({
 *   configDir: 'config',
 *   packageManager: 'npm',
 * });
 * ```
 */
export const runDoctor = async (options: DoctorOptions = {}) => {
  const args = ['doctor'];

  if (options.configDir) {
    args.push('--config-dir', options.configDir);
  }

  if (options.packageManager) {
    args.push('--package-manager', options.packageManager);
  }

  return executeCommand(args, options);
};
