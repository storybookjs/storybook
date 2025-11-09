import { spawn } from 'child_process';

const PACKAGE_MANAGER_TO_COMMAND = {
  npm: 'npx',
  pnpm: 'pnpm dlx',
  yarn1: 'npx',
  yarn2: 'yarn dlx',
  bun: 'bunx',
};

const selectPackageManagerCommand = (packageManager: string) =>
  PACKAGE_MANAGER_TO_COMMAND[packageManager as keyof typeof PACKAGE_MANAGER_TO_COMMAND];

export default async function postinstall({ packageManager = 'npm' }) {
  const command = selectPackageManagerCommand(packageManager);

  await spawn(`${command} @storybook/auto-config themes`, {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true,
  });
}
