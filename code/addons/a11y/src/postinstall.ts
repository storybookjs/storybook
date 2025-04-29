import { getAutomigrateCommand } from 'storybook/internal/cli';

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
  await $({
    stdio: 'inherit',
  })`${getAutomigrateCommand('addonA11yAddonTest', {
    yes: options.yes,
    configDir: options.configDir,
    packageManager: options.packageManager,
  })}`;
}
