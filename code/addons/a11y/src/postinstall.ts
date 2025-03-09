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
  })`storybook automigrate addonA11yAddonTest ${options.yes ? '--yes' : ''}`;
}
