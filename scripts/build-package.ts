/**
 * This is the entrypoint for when you run:
 *
 * @example `nr build storybook --watch`
 *
 * You can pass a list of package names to build, or use the `--all` flag to build all packages.
 *
 * Pass the `--watch` flag to build in watch mode or `--no-watch` to skip the watch mode prompt.
 *
 * Pass the `--prod` flag to build in production mode or `--no-prod` to skip the production prompt.
 *
 * When you pass no package names, you will be prompted to select which packages to build.
 */
import { join } from 'node:path';

import { exec } from 'child_process';
import { program } from 'commander';
import { resolve } from 'path';
import picocolors from 'picocolors';
import prompts from 'prompts';
import windowSize from 'window-size';

import { ROOT_DIRECTORY } from './utils/constants';
import { findMostMatchText } from './utils/diff';
import { getCodeWorkspaces } from './utils/workspace';

async function run() {
  const packages = (await getCodeWorkspaces())
    .filter(({ name }) => name !== '@storybook/code')
    .sort((a) => (a.name === 'storybook' ? -1 : 0)); // Place main package first in option list

  const tasks: Record<
    string,
    {
      name: string;
      defaultValue: boolean;
      suffix: string;
      value?: unknown;
      location?: string;
    }
  > = packages
    .map((pkg) => {
      let suffix = pkg.name.replace('@storybook/', '');
      if (pkg.name === '@storybook/cli') {
        suffix = 'sb-cli';
      }
      return {
        ...pkg,
        suffix,
        defaultValue: false,
      };
    })
    .reduce(
      (acc, next) => {
        acc[next.name] = next;
        return acc;
      },
      {} as Record<string, { name: string; defaultValue: boolean; suffix: string }>
    );

  const main = program
    .version('5.0.0')
    .allowExcessArguments(true)
    .option('--all', `build everything ${picocolors.gray('(all)')}`, false)
    .option('--watch', `build in watch mode`)
    .option('--prod', `build in production mode`)
    .option('--no-watch', `do not build in watch mode`)
    .option('--no-prod', `do not build in production mode`);

  main.parse(process.argv);

  const opts = main.opts();
  let watchMode = opts.watch;
  let prodMode = opts.prod;

  Object.keys(tasks).forEach((key) => {
    // checks if a flag is passed e.g. yarn build addon-docs --watch
    const containsFlag = main.args.includes(tasks[key].suffix);
    tasks[key].value = containsFlag || opts.all;
  });

  let selection = Object.values(tasks).filter((item) => item.value === true);

  // check for invalid package name(s) and try to guess the correct package name(s)
  const suffixList = Object.values(tasks).map((t) => t.suffix);
  let hasInvalidName = false;

  for (const arg of main.args) {
    if (!suffixList.includes(arg)) {
      const matchText = findMostMatchText(suffixList, arg);

      if (matchText) {
        hasInvalidName = true;
        process.stderr.write(
          `${picocolors.red('Error')}: ${picocolors.cyan(
            arg
          )} is not a valid package name, Did you mean ${picocolors.cyan(matchText)}?\n`
        );
      }
    }
  }

  if (hasInvalidName) {
    process.exit(1);
  }

  if (!selection.length) {
    selection = await prompts(
      [
        watchMode === undefined && {
          type: 'toggle',
          name: 'watch',
          message: 'Start in watch mode',
          initial: false,
          active: 'yes',
          inactive: 'no',
        },
        prodMode === undefined && {
          type: 'toggle',
          name: 'prod',
          message: 'Start in production mode',
          initial: false,
          active: 'yes',
          inactive: 'no',
        },
        {
          type: 'autocompleteMultiselect',
          message: 'Select the packages to build',
          name: 'todo',
          min: 1,
          hint: 'You can also run directly with package name like `yarn build storybook`, or `yarn build --all` for all packages!',
          // @ts-expect-error @types incomplete
          optionsPerPage: windowSize.height - 3, // 3 lines for extra info
          choices: packages.map(({ name: key }) => ({
            value: key,
            title: tasks[key].name || key,
            selected: (tasks[key] && tasks[key].defaultValue) || false,
          })),
        },
      ],
      { onCancel: () => process.exit(0) }
    ).then(({ watch, prod, todo }: { watch: boolean; prod: boolean; todo: Array<string> }) => {
      watchMode = watch;
      prodMode = prod;
      return todo?.map((key) => tasks[key]);
    });
  }

  process.stdout.write('Building selected packages...\n');
  let lastName = '';

  selection.forEach(async (v) => {
    const script = join(ROOT_DIRECTORY, 'scripts', 'build', 'build-package.ts');
    const command = `yarn exec jiti ${script}`;

    const cwd = resolve(__dirname, '..', 'code', v.location);
    const sub = exec(`${command}${watchMode ? ' --watch' : ''}${prodMode ? ' --prod' : ''}`, {
      cwd,
      env: {
        NODE_ENV: 'production',
        ...process.env,
        FORCE_COLOR: '1',
      },
    });

    sub.stdout?.on('data', (data) => {
      if (lastName !== v.name) {
        const prefix = `${picocolors.cyan(v.name)}:\n`;
        process.stdout.write(prefix);
      }
      lastName = v.name;
      process.stdout.write(data);
    });
    sub.stderr?.on('data', (data) => {
      if (lastName !== v.name) {
        const prefix = `${picocolors.cyan(v.name)}:\n`;
        process.stdout.write(prefix);
      }
      lastName = v.name;
      process.stderr.write(data);
    });
  });
}

run().catch((e) => {
  process.stderr.write(`${e.toString()}\n`);
  process.exit(1);
});
