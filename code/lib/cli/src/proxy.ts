import { versions } from '@storybook/core/common';

import { spawn } from 'child_process';

const args = process.argv.slice(2);

const run = async () => {
  await import('@storybook/core/cli/bin');
};

if (['dev', 'build'].includes(args[0])) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  const proxiedArgs =
    args[0] === 'init'
      ? [`create-storybook@${versions.storybook}`, ...args.slice(1)]
      : [`@storybook/cli@${versions.storybook}`, ...args];
  const command = ['npx', '--yes', ...proxiedArgs];
  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code != null) {
      process.exit(code);
    }
    process.exit(1);
  });
}
