/**
 * This is the entrypoint for when you run:
 *
 * @example `nr build storybook --watch`
 *
 * You can pass a list of package names to build, or use the `--all` flag to build all packages.
 *
 * You can also pass the `--watch` flag to build in watch mode.
 *
 * You can also pass the `--prod` flag to build in production mode.
 *
 * When you pass no package names, you will be prompted to select which packages to build.
 */
import { readFile } from 'node:fs/promises';

import { exec } from 'child_process';
import { program } from 'commander';
import { posix, resolve, sep } from 'path';
import picocolors from 'picocolors';
import prompts from 'prompts';
import windowSize from 'window-size';

import { findMostMatchText } from './utils/diff';
import { getWorkspaces } from './utils/workspace';

async function run() {
  const packages = (await getWorkspaces()).filter(({ name }) => name !== '@storybook/root');
  const packageTasks = packages
    .map((pkg) => {
      let suffix = pkg.name.replace('@storybook/', '');
      if (pkg.name === '@storybook/cli') {
        suffix = 'sb-cli';
      }
      return {
        ...pkg,
        suffix,
        defaultValue: false,
        helpText: `build only the ${pkg.name} package`,
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
      helpText: 'build on watch mode',
    },
    prod: {
      name: `prod`,
      defaultValue: false,
      suffix: '--prod',
      helpText: 'build on production mode',
    },
    ...packageTasks,
  };

  const main = program
    .version('5.0.0')
    .option('--all', `build everything ${picocolors.gray('(all)')}`);

  Object.keys(tasks)
    .reduce((acc, key) => acc.option(tasks[key].suffix, tasks[key].helpText), main)
    .parse(process.argv);

  Object.keys(tasks).forEach((key) => {
    const opts = program.opts();
    // checks if a flag is passed e.g. yarn build --@storybook/addon-docs --watch
    const containsFlag = program.args.includes(tasks[key].suffix);
    tasks[key].value = containsFlag || opts.all;
  });

  let watchMode = process.argv.includes('--watch');
  let prodMode = process.argv.includes('--prod');
  let selection = Object.keys(tasks)
    .map((key) => tasks[key])
    .filter((item) => !['watch', 'prod'].includes(item.name) && item.value === true);

  // user has passed invalid package name(s) - try to guess the correct package name(s)
  if ((!selection.length && main.args.length >= 1) || selection.length !== main.args.length) {
    const suffixList = Object.values(tasks)
      .filter((t) => t.name.includes('@storybook'))
      .map((t) => t.suffix);

    for (const arg of main.args) {
      if (!suffixList.includes(arg)) {
        const matchText = findMostMatchText(suffixList, arg);

        if (matchText) {
          console.log(
            `${picocolors.red('Error')}: ${picocolors.cyan(
              arg
            )} is not a valid package name, Did you mean ${picocolors.cyan(matchText)}?`
          );
        }
      }
    }

    process.exit(0);
  }

  if (!selection.length) {
    selection = await prompts(
      [
        {
          type: 'toggle',
          name: 'watch',
          message: 'Start in watch mode',
          initial: false,
          active: 'yes',
          inactive: 'no',
        },
        {
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
          hint: 'You can also run directly with package name like `yarn build core`, or `yarn build --all` for all packages!',
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

  console.log('Building selected packages...');
  let lastName = '';

  selection.forEach(async (v) => {
    const content = await readFile(resolve('../code', v.location, 'package.json'), 'utf-8');
    const command = JSON.parse(content).scripts?.prep.split(posix.sep).join(sep);

    if (!command) {
      console.log(`No prep script found for ${v.name}`);
      return;
    }

    const cwd = resolve(__dirname, '..', 'code', v.location);
    const sub = exec(
      `${command}${watchMode ? ' --watch' : ''}${prodMode ? ' --optimized' : ''} --reset`,
      {
        cwd,
        env: {
          NODE_ENV: 'production',
          ...process.env,
          FORCE_COLOR: '1',
        },
      }
    );

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

run();
