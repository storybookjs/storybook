import { JsPackageManagerFactory, versions } from 'storybook/internal/common';

import type { PostinstallOptions } from '../../../lib/cli-storybook/src/add.ts';

export default async function postinstall(options: PostinstallOptions) {
  const args = [
    options.skipInstall ? `storybook@${versions.storybook}` : `storybook`,
    'automigrate',
    'addon-a11y-addon-test',
  ];

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

  // stdio must not be left as open pipes: the nested CLI (and the npm exec layers in between)
  // can block on them forever, which freezes the outer upgrade/add command without any output.
  await jsPackageManager.runPackageCommand({
    args,
    stdio: 'ignore',
    useRemotePkg: !!options.skipInstall,
  });
}
