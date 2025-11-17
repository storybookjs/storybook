import { JsPackageManagerFactory } from 'storybook/internal/common';

import type { PostinstallOptions } from '../../../lib/cli-storybook/src/add';

export default async function postinstall(options: PostinstallOptions) {
  const args = ['storybook', 'automigrate', 'addon-a11y-addon-test'];

  args.push('--loglevel', 'silent');
  args.push('--skip-doctor');

  if (options.yes) {
    args.push('--yes');
  }

  if (options.packageManager) {
    args.push('--package-manager', options.packageManager);
  }

  if (options.configDir) {
    args.push('--config-dir', options.configDir);
  }

  const jsPackageManager = JsPackageManagerFactory.getPackageManager({
    force: options.packageManager,
    configDir: options.configDir,
  });

  await jsPackageManager.runPackageCommand('storybook', args);
}
