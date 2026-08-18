#!/usr/bin/env node
import Module from 'node:module';
import { pathToFileURL } from 'node:url';

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
 * - Core Storybook commands (dev, build, index, ai, tools, skills) are routed to the core binary at
 *   storybook/dist/bin/core.js — `ai`, `tools`, and `skills` are bundled because agent workflows
 *   invoke them repeatedly and must never wait on an npx download
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
  // Cache compiled V8 bytecode on disk (a Node-version-scoped directory under os.tmpdir()) so
  // repeated CLI invocations — agents call `storybook tools` many times per session — skip the
  // parse/compile of the module graph. Called before the dynamic imports below so the heavy
  // bundles are covered. Missing on Node < 22.8, hence the feature detection; the cache is purely
  // an accelerator, so failing to enable it must never fail the CLI.
  try {
    Module.enableCompileCache?.();
  } catch {}

  const args = process.argv.slice(2);

  if (['dev', 'build', 'index', 'ai', 'tools', 'skills'].includes(args[0])) {
    const coreBin = pathToFileURL(join(resolvePackageDir('storybook'), 'dist/bin/core.js')).href;
    await import(coreBin);
    return;
  }

  // Only the external-CLI routes below need the package-manager machinery; importing it lazily
  // keeps the (hot) core route above from evaluating that dependency-heavy part of `common`.
  const { JsPackageManagerFactory, executeNodeCommand, getRemotePackageRunnerArgs } =
    await import('storybook/internal/common');

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
