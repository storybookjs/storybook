// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

import type { PostinstallOptions } from '../../../lib/cli-storybook/src/add';

const $ = execa({
  preferLocal: true,
  stdio: 'inherit',
  // we stream the stderr to the console
  reject: false,
});

export default async function postinstall(options: PostinstallOptions) {
  const command = ['storybook', 'automigrate', 'addon-a11y-addon-test'];

  command.push('--loglevel', 'silent');
  command.push('--skip-doctor');

  if (options.yes) {
    command.push('--yes');
  }

  if (options.packageManager) {
    command.push('--package-manager', options.packageManager);
  }

  if (options.configDir) {
    command.push('--config-dir', `"${options.configDir}"`);
  }

  await $`${command.join(' ')}`;
}
