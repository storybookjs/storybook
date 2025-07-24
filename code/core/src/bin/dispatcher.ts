#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { logger } from 'storybook/internal/node-logger';

import { join } from 'pathe';
import { dedent } from 'ts-dedent';

import versions from '../common/versions';
import { resolvePackageDir } from '../shared/utils/module';

/**
 * Dispatches Storybook CLI commands to the appropriate handler.
 *
 * This function serves as the main entry point for Storybook CLI operations.
 *
 * - Core Storybook commands (dev, build, index) are routed to the core binary at
 *   storybook/dist/bin/core.js
 * - Init is routed to the create-storybook package via npx
 * - External CLI tools (upgrade, doctor, etc.) are routed to @storybook/cli via npx
 */
const [majorNodeVersion, minorNodeVersion] = process.versions.node.split('.').map(Number);
if (
  majorNodeVersion < 20 ||
  (majorNodeVersion === 20 && minorNodeVersion < 19) ||
  (majorNodeVersion === 22 && minorNodeVersion < 12)
) {
  logger.error(
    dedent`To run Storybook, you need Node.js version 20.19+ or 22.12+.
    You are currently running Node.js ${process.version}. Please upgrade your Node.js installation.`
  );
  process.exit(1);
}

async function run() {
  const args = process.argv.slice(2);

  if (['dev', 'build', 'index'].includes(args[0])) {
    const coreBin = pathToFileURL(join(resolvePackageDir('storybook'), 'dist/bin/core.js')).href;
    await import(coreBin);
    return;
  }

  const targetCli =
    args[0] === 'init'
      ? ({
          pkg: 'create-storybook',
          args: args.slice(1),
        } as const)
      : ({
          pkg: '@storybook/cli',
          args,
        } as const);

  let command;
  try {
    const { default: targetCliPackageJson } = await import(`${targetCli.pkg}/package.json`, {
      with: { type: 'json' },
    });
    if (targetCliPackageJson.version === versions[targetCli.pkg]) {
      command = [
        'node',
        `"${join(resolvePackageDir(targetCli.pkg), 'dist/bin/index.js')}"`,
        ...targetCli.args,
      ];
    }
  } catch (e) {
    // the package couldn't be imported, use npx to install and run it instead
  }
  command ??= ['npx', '--yes', `${targetCli.pkg}@${versions[targetCli.pkg]}`, ...targetCli.args];

  const child = spawn(command[0], command.slice(1), { stdio: 'inherit', shell: true });
  child.on('exit', (code) => {
    process.exit(code);
  });
}

run();
