import type {
  AutofixOptionsFromCLI,
  FixesIDs,
  allFixes,
} from '../../../lib/cli-storybook/src/automigrate/fixes';

/**
 * Get the command to run an automigration
 *
 * @example
 *
 * ```ts
 * const command = getAutomigrateCommand('addon-a11y-parameters', {
 *   yes: true,
 *   configDir: 'config',
 *   packageManager: 'npm',
 * });
 * // ['storybook', 'automigrate', 'addon-a11y-parameters', '--yes', '--config-dir', 'config', '--package-manager', 'npm']
 * ```
 */
export const getAutomigrateCommand = (
  fixId: FixesIDs<typeof allFixes>,
  options: Pick<AutofixOptionsFromCLI, 'yes' | 'configDir' | 'packageManager'>
) => {
  const command = ['storybook', 'automigrate', fixId];
  if (options.yes) {
    command.push('--yes');
  }

  if (options.configDir) {
    command.push('--config-dir', options.configDir);
  }

  if (options.packageManager) {
    command.push('--package-manager', options.packageManager);
  }

  return command;
};
