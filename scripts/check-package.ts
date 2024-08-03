// This script makes sure that we can support type checking,
// without having to build dts files for all packages in the monorepo.
// It is not implemented yet for angular, svelte and vue.
import { resolve } from 'path';
import { readJSON } from '@ndelangen/fs-extra-unified';
import prompts from 'prompts';
import program from 'commander';
import chalk from 'chalk';
import windowSize from 'window-size';
import { execaCommand } from 'execa';
import { getWorkspaces } from './utils/workspace';

async function run() {
  const packages = await getWorkspaces();
  const packageTasks = packages
    .map((pkg) => {
      return {
        ...pkg,
        suffix: pkg.name.replace('@storybook/', ''),
        defaultValue: false,
        helpText: `check only the ${pkg.name} package`,
      };
    })
    .reduce(
      (acc, next) => {
        acc[next.name] = next;
        return acc;
      },
      {} as Record<
        string,
        { name: string; defaultValue: boolean; suffix: string; helpText: string }
      >
    );

  const tasks: Record<
    string,
    {
      name: string;
      defaultValue: boolean;
      suffix: string;
      helpText: string;
      value?: any;
      location?: string;
    }
  > = {
    watch: {
      name: `watch`,
      defaultValue: false,
      suffix: '--watch',
      helpText: 'check on watch mode',
    },
    ...packageTasks,
  };

  const main = program.version('5.0.0').option('--all', `check everything ${chalk.gray('(all)')}`);

  Object.keys(tasks)
    .reduce((acc, key) => acc.option(tasks[key].suffix, tasks[key].helpText), main)
    .parse(process.argv);

  Object.keys(tasks).forEach((key) => {
    // checks if a flag is passed e.g. yarn check --@storybook/addon-docs --watch
    const containsFlag = program.rawArgs.includes(tasks[key].suffix);
    tasks[key].value = containsFlag || program.all;
  });

  let selection;
  let watchMode = false;
  if (
    !Object.keys(tasks)
      .map((key) => tasks[key].value)
      .filter(Boolean).length
  ) {
    selection = await prompts([
      {
        type: 'toggle',
        name: 'mode',
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
        hint: 'You can also run directly with package name like `yarn check core`, or `yarn check --all` for all packages!',
        // @ts-expect-error @types incomplete
        optionsPerPage: windowSize.height - 3, // 3 lines for extra info
        choices: packages.map(({ name: key }) => ({
          value: key,
          title: tasks[key].name || key,
          selected: (tasks[key] && tasks[key].defaultValue) || false,
        })),
      },
    ]).then(({ mode, todo }: { mode: boolean; todo: Array<string> }) => {
      watchMode = mode;
      return todo?.map((key) => tasks[key]);
    });
  } else {
    // hits here when running yarn check --packagename
    watchMode = process.argv.includes('--watch');
    selection = Object.keys(tasks)
      .map((key) => tasks[key])
      .filter((item) => item.name !== 'watch' && item.value === true);
  }

  selection?.filter(Boolean).forEach(async (v) => {
    const command = (await readJSON(resolve('../code', v.location, 'package.json'))).scripts.check;
    const cwd = resolve(__dirname, '..', 'code', v.location);
    const sub = execaCommand(`${command}${watchMode ? ' --watch' : ''}`, {
      cwd,
      buffer: false,
      shell: true,
      cleanup: true,
      env: {
        NODE_ENV: 'production',
      },
    });

    sub.stdout.on('data', (data) => {
      process.stdout.write(`${chalk.cyan(v.name)}:\n${data}`);
    });
    sub.stderr.on('data', (data) => {
      process.stderr.write(`${chalk.red(v.name)}:\n${data}`);
    });
  });
}

run().catch((e) => {
  console.log(e);
  process.exit(1);
});
