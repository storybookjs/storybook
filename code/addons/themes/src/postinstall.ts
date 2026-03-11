import { PackageManagerName } from 'storybook/internal/common';

import { spawnSync } from 'child_process';

const PACKAGE_MANAGER_TO_COMMAND = {
  [PackageManagerName.NPM]: 'npx',
  [PackageManagerName.PNPM]: 'pnpm dlx',
  [PackageManagerName.YARN1]: 'npx',
  [PackageManagerName.YARN2]: 'yarn dlx',
  [PackageManagerName.BUN]: 'bunx',
};

const selectPackageManagerCommand = (packageManager: string) =>
  PACKAGE_MANAGER_TO_COMMAND[packageManager as keyof typeof PACKAGE_MANAGER_TO_COMMAND];

export default async function postinstall({ packageManager = PackageManagerName.NPM }) {
  const commandString = selectPackageManagerCommand(packageManager);
  const [command, ...commandArgs] = commandString.split(' ');

  spawnSync(command, [...commandArgs, '@storybook/auto-config', 'themes'], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
}
