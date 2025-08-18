import { spawn } from 'child_process';

const PACKAGE_MANAGER_TO_COMMAND = {
  npm: ['npx'],
  pnpm: ['pnpm', 'dlx'],
  yarn1: ['npx'],
  yarn2: ['yarn', 'dlx'],
  bun: ['bunx'],
};

const selectPackageManagerCommand = (packageManager: string) =>
  PACKAGE_MANAGER_TO_COMMAND[packageManager as keyof typeof PACKAGE_MANAGER_TO_COMMAND];

const spawnPackageManagerScript = async (packageManager: string, args: string[]) => {
  const [command, ...baseArgs] = selectPackageManagerCommand(packageManager);

  await spawn(command, [...baseArgs, ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true,
  });
};

export default async function postinstall({ packageManager = 'npm' }) {
  await spawnPackageManagerScript(packageManager, ['@storybook/auto-config', 'themes']);
}
