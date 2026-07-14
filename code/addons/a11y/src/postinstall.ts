import { JsPackageManagerFactory, versions } from 'storybook/internal/common';

import type { PostinstallOptions } from '../../../lib/cli-storybook/src/add.ts';

export default async function postinstall(options: PostinstallOptions) {
  const useRemotePkg = options.useRemotePkg ?? !!options.skipInstall;
  const args = [
    // A versioned spec only resolves through the ephemeral runner; the local
    // binary is invoked by bare name.
    useRemotePkg ? `storybook@${versions.storybook}` : `storybook`,
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

  await jsPackageManager.runPackageCommand({ args, useRemotePkg });
}
