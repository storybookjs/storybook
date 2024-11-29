const { spawn } = require('child_process');

const PACKAGE_MANAGER_TO_COMMAND = {
  npm: ['npx'],
  pnpm: ['pnpm', 'dlx'],
  yarn1: ['npx'],
  yarn2: ['yarn', 'dlx'],
  bun: ['bunx'],
};

const selectPackageManagerCommand = (packageManager) => PACKAGE_MANAGER_TO_COMMAND[packageManager];

const spawnPackageManagerScript = async (packageManager, args) => {
  const [command, ...baseArgs] = selectPackageManagerCommand(packageManager);

  await spawn(command, [...baseArgs, ...args], {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true,
  });
};

module.exports = async function postinstall({ packageManager = 'npm' }) {
  await spawnPackageManagerScript(packageManager, ['@storybook/auto-config', 'themes']);
};
