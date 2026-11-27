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
 * - Core Storybook commands (dev, build, index, tools, skills) are routed to the core binary at
 *   storybook/dist/bin/core.js — `tools` and `skills` are bundled because agent workflows invoke
 *   them repeatedly and must never wait on an npx download
 * - Init is routed to the create-storybook package via the detected package manager
 * - External CLI tools (upgrade, doctor, etc.) are routed to @storybook/cli the same way
 */
if (!isNodeVersionSupported(process.versions.node)) {
  logger.error(
    dedent`To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.
    You are currently running Node.js ${process.version}. Please upgrade your Node.js installation.`
  );
  process.exit(1);
}

async function run() {
  Module.enableCompileCache();

  const args = process.argv.slice(2);

  // Agents that learned `storybook ai setup` from Storybook 10 docs keep calling it, and the generic
  // "Did you mean add?" fallback would steer them to the wrong command. Remove in Storybook 12.
  if (args[0] === 'ai') {
    logger.error(
      dedent`The \`storybook ai\` command was removed in Storybook 11.
      Run \`npx storybook skills setup\` instead of \`storybook ai setup\`, and \`npx storybook tools\` for the other \`ai\` subcommands.`
    );
    process.exit(1);
  }

  if (args[0] === 'tools' && !args.includes('--no-attach')) {
    process.env.STORYBOOK_ATTACHED_TOOLS = 'true';
  }

  if (['dev', 'build', 'index', 'tools', 'skills'].includes(args[0])) {
    const coreBin = pathToFileURL(join(resolvePackageDir('storybook'), 'dist/bin/core.js')).href;
    await import(coreBin);
    return;
  }

  // Only the external-CLI routes below need the package-manager machinery; importing it lazily
  // keeps the (hot) core route above from evaluating that dependency-heavy part of `common`.
  const {
    JsPackageManagerFactory,
    executeNodeCommand,
    getPkgPrNewPackageSpecifier,
    getRemotePackageRunnerArgs,
    resolveStorybookVersionSpecifier,
    runStorybookInstallPrecheck,
    STORYBOOK_VERSION_SPECIFIER_ENV,
  } = await import('storybook/internal/common');

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

  const storybookVersionSpecifier = resolveStorybookVersionSpecifier();
  if (storybookVersionSpecifier) {
    process.env[STORYBOOK_VERSION_SPECIFIER_ENV] = storybookVersionSpecifier;
  }

  const dispatchedVersion =
    getPkgPrNewPackageSpecifier(targetCli.pkg, storybookVersionSpecifier) ??
    versions[targetCli.pkg];

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

  // `upgrade` and `init` run this precheck themselves, but the age gate also blocks downloading them.
  // The precheck can write the package manager's config, which a dry run or a help call must not do.
  // Only the package downloaded below knows the command's options, so reading them here is best
  // effort. Commander also takes short flags from a cluster such as `-yn`, up to `-c`, which takes a value.
  const hasFlag = (long: string, short: string) =>
    args.some(
      (arg) => arg === long || (/^-[^-]/.test(arg) && arg.slice(1).split('c')[0].includes(short))
    );
  const installsNothing =
    hasFlag('--help', 'h') || (args[0] === 'upgrade' && hasFlag('--dry-run', 'n'));
  if ((args[0] === 'upgrade' || args[0] === 'init') && !installsNothing) {
    const { detectAgent } = await import('../telemetry/detect-agent.ts');
    // `init` answers its own prompts in agent mode. Commander lets the last of the two flags win.
    const agentFlag = args.findLast((arg) => arg === '--agent' || arg === '--no-agent');
    const isAgentInit =
      args[0] === 'init' && (agentFlag ? agentFlag === '--agent' : !!detectAgent());
    try {
      await runStorybookInstallPrecheck(packageManager, {
        storybookVersion: versions.storybook,
        installContext: args[0] === 'init' ? 'create' : 'upgrade',
        yes: hasFlag('--yes', 'y') || isAgentInit,
      });
    } catch {
      // The precheck has told the user why this Storybook version cannot be installed.
      process.exit(1);
    }
  }

  const child = packageManager.runPackageCommand({
    args: getRemotePackageRunnerArgs(
      packageManager.type,
      targetCli.pkg,
      dispatchedVersion,
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
