import { versions } from 'storybook/internal/common';
import { addToGlobalContext } from 'storybook/internal/telemetry';

import { program } from 'commander';
import { findPackageSync } from 'fd-package-json';
import invariant from 'tiny-invariant';

import type { CommandOptions } from '../generators/types';
import { initiate } from '../initiate';

addToGlobalContext('cliVersion', versions.storybook);

const pkg = findPackageSync(__dirname);
invariant(pkg, 'Failed to find the closest package.json file.');

program
  .name('Initialize Storybook into your project.')
  .option(
    '--disable-telemetry',
    'Disable sending telemetry data',
    // default value is false, but if the user sets STORYBOOK_DISABLE_TELEMETRY, it can be true
    process.env.STORYBOOK_DISABLE_TELEMETRY && process.env.STORYBOOK_DISABLE_TELEMETRY !== 'false'
  )
  .option('--debug', 'Get more logs in debug mode', false)
  .option('--enable-crash-reports', 'Enable sending crash reports to telemetry data')
  .option('-f --force', 'Force add Storybook')
  .option('-s --skip-install', 'Skip installing deps')
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2|bun>',
    'Force package manager for installing deps'
  )
  .option('--use-pnp', 'Enable pnp mode for Yarn 2+')
  .option('-p --parser <babel | babylon | flow | ts | tsx>', 'jscodeshift parser')
  .option('-t --type <type>', 'Add Storybook for a specific project type')
  .option('-y --yes', 'Answer yes to all prompts')
  .option('-b --builder <webpack5 | vite>', 'Builder library')
  .option('-l --linkable', 'Prepare installation for link (contributor helper)')
  // due to how Commander handles default values and negated options, we have to elevate the default into Commander, and we have to specify `--dev`
  // alongside `--no-dev` even if we are unlikely to directly use `--dev`. https://github.com/tj/commander.js/issues/2068#issuecomment-1804524585
  .option(
    '--dev',
    'Launch the development server after completing initialization. Enabled by default',
    process.env.CI !== 'true' && process.env.IN_STORYBOOK_SANDBOX !== 'true'
  )
  .option(
    '--no-dev',
    'Complete the initialization of Storybook without launching the Storybook development server'
  )
  .action((options: CommandOptions) => {
    initiate(options).catch(() => process.exit(1));
  })
  .version(String(pkg.version))
  .parse(process.argv);
