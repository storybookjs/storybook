import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import versions from '../common/versions';

const args = process.argv.slice(2);

if (['dev', 'build'].includes(args[0])) {
  require('storybook/internal/cli/bin');
} else {
  let command;
  if (args[0] === 'init') {
    let foundCreateStorybook;
    try {
      foundCreateStorybook = require.resolve('create-storybook/package.json');
    } catch (e) {
      // ignore
    }
    if (foundCreateStorybook) {
      const json = JSON.parse(readFileSync(foundCreateStorybook, 'utf-8'));
      if (json.version === versions['create-storybook']) {
        command = [
          'node',
          join(dirname(foundCreateStorybook), 'bin', 'index.cjs'),
          ...args.slice(1),
        ];
      }
    } else {
      command = ['npx', '--yes', `create-storybook@${versions.storybook}`, ...args.slice(1)];
    }
  } else {
    let foundStorybookCLI;
    try {
      foundStorybookCLI = require.resolve('@storybook/cli/package.json');
    } catch (e) {
      // ignore
    }

    if (foundStorybookCLI) {
      const json = JSON.parse(readFileSync(foundStorybookCLI, 'utf-8'));
      if (json.version === versions['@storybook/cli']) {
        command = ['node', join(dirname(foundStorybookCLI), 'bin', 'index.cjs'), ...args];
      }
    } else {
      command = ['npx', '--yes', `@storybook/cli@${versions.storybook}`, ...args];
    }
  }

  if (!command) {
    console.error('Could not run storybook cli, please report this as a bug');
    process.exit(1);
  }

  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    if (code != null) {
      process.exit(code);
    }
    process.exit(1);
  });
}
