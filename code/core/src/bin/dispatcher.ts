#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

import {
  JsPackageManagerFactory,
  executeNodeCommand,
  getRemotePackageRunnerArgs,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { join } from 'pathe';
import { dedent } from 'ts-dedent';

import { MIN_SUPPORTED_NODE_DESCRIPTION, isNodeVersionSupported } from '../common/node-version.ts';
import versions from '../common/versions.ts';
import { resolvePackageDir } from '../shared/utils/module.ts';

/**
 * Dispatches Storybook CLI commands to the appropriate handler.
 *
 * This function serves as the main entry point for Storybook CLI operations.
 *
 * - Core Storybook commands (dev, build, index, ai) are routed to the core binary at
 *   storybook/dist/bin/core.js — `ai` is bundled because agent skills invoke it repeatedly and
 *   must never wait on an npx download
 * - Init is routed to the create-storybook package via the detected package manager
 * - External CLI tools (upgrade, doctor, etc.) are routed to @storybook/cli the same way
 */
const [major, minor, patch] = process.versions.node.split('.').map(Number);
if (!isNodeVersionSupported(major, minor, patch)) {
  logger.error(
    dedent`To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.
    You are currently running Node.js ${process.version}. Please upgrade your Node.js installation.`
  );
  process.exit(1);
}

async function run() {
  const args = process.argv.slice(2);

  if (['dev', 'build', 'index', 'ai'].includes(args[0])) {
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

  try {
    const { default: targetCliPackageJson } = await import(`${targetCli.pkg}/package.json`, {
      with: { type: 'json' },
    });
    if (targetCliPackageJson.version === versions[targetCli.pkg]) {
      const child = executeNodeCommand({
        scriptPath: join(resolvePackageDir(targetCli.pkg), 'dist/bin/index.js'),
        args: targetCli.args,
        options: {
          stdio: 'inherit',
        },
      });
      child.on('exit', (code) => {
        process.exit(code ?? 1);
      });
      return;
    }
  } catch {
    // the package couldn't be imported, download and run it with the detected package manager
  }

  const packageManager = JsPackageManagerFactory.getPackageManager();
  const child = packageManager.runPackageCommand({
    args: getRemotePackageRunnerArgs(
      packageManager.type,
      targetCli.pkg,
      versions[targetCli.pkg],
      targetCli.args
    ),
    useRemotePkg: true,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

run();
