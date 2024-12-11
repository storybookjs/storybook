import type { PostinstallOptions } from '@storybook/cli/src/add';

// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

const $ = execa({
  preferLocal: true,
  stdio: 'inherit',
  // we stream the stderr to the console
  reject: false,
});

export default async function postinstall(options: PostinstallOptions) {
  await $`storybook automigrate addonA11yAddonTest ${options.yes ? '--yes' : ''}`;
}
