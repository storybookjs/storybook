// This script makes sure that we can support type checking,
// without having to build dts files for all packages in the monorepo.
// It is not implemented yet for angular, svelte and vue.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { program } from 'commander';
// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import { resolve } from 'path';
import picocolors from 'picocolors';
import prompts from 'prompts';
import windowSize from 'window-size';

import { ROOT_DIRECTORY } from './utils/constants';
import { getCodeWorkspaces } from './utils/workspace';

async function run() {
  // Place main package first in option list
  const packages = (await getCodeWorkspaces())
    .filter(({ name }) => name !== '@storybook/code')
    .sort((a) => (a.name === 'storybook' ? -1 : 0));

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
    .option('--all', `check everything ${picocolors.gray('(all)')}`)
    .option('--watch', `build in watch mode`)
    .option('--no-watch', `do not build in watch mode`);

  main.parse(process.argv);

  const opts = program.opts();
  let watchMode = opts.watch;

  Object.keys(tasks).forEach((key) => {
    const opts = program.opts();
    // checks if a flag is passed e.g. yarn check addon-docs --watch
    const containsFlag = program.args.includes(tasks[key].suffix);
    tasks[key].value = containsFlag || opts.all;
  });

  let selection = Object.values(tasks).filter((item) => item.value === true);
  if (!selection.length) {
    selection = await prompts([
      watchMode === undefined && {
        type: 'toggle',
        name: 'watch',
        message: 'Start in watch mode',
        initial: false,
        active: 'yes',
        inactive: 'no',
      },
      {
        type: 'autocompleteMultiselect',
        message: 'Select the packages to check',
        name: 'todo',
        min: 1,
        hint: 'You can also run directly with package name like `yarn check storybook`, or `yarn check --all` for all packages!',
        // @ts-expect-error @types incomplete
        optionsPerPage: windowSize.height - 3, // 3 lines for extra info
        choices: packages.map(({ name: key }) => ({
          value: key,
          title: tasks[key].name || key,
          selected: (tasks[key] && tasks[key].defaultValue) || false,
        })),
      },
    ]).then(({ watch, todo }: { watch: boolean; todo: Array<string> }) => {
      watchMode = watch;
      return todo?.map((key) => tasks[key]);
    });
  }

  process.stdout.write('Checking selected packages...\n');
  let lastName = '';

  selection.forEach(async (v) => {
    console.log(v);

    const script = join(ROOT_DIRECTORY, 'scripts', 'check', 'check-package.ts');
    const command = `yarn exec jiti ${script}`;

    const cwd = resolve(__dirname, '..', 'code', v.location);
    const sub = execaCommand(`${command}${watchMode ? ' --watch' : ''}`, {
      cwd,
      env: {
        NODE_ENV: 'production',
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
