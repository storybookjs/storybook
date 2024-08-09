import { resolve, posix, sep } from 'path';
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
      let suffix = pkg.name.replace('@storybook/', '');
      if (pkg.name === '@storybook/cli') {
        suffix = 'sb-cli';
      }
      if (pkg.name === 'storybook') {
        suffix = 'cli';
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

  const main = program.version('5.0.0').option('--all', `build everything ${chalk.gray('(all)')}`);

  Object.keys(tasks)
    .reduce((acc, key) => acc.option(tasks[key].suffix, tasks[key].helpText), main)
    .parse(process.argv);

  Object.keys(tasks).forEach((key) => {
    // checks if a flag is passed e.g. yarn build --@storybook/addon-docs --watch
    const containsFlag = program.rawArgs.includes(tasks[key].suffix);
    tasks[key].value = containsFlag || program.all;
  });

  let selection;
  let watchMode = false;
  let prodMode = false;
  if (
    !Object.keys(tasks)
      .map((key) => tasks[key].value)
      .filter(Boolean).length
  ) {
    selection = await prompts([
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
    ]).then(({ watch, prod, todo }: { watch: boolean; prod: boolean; todo: Array<string> }) => {
      watchMode = watch;
      prodMode = prod;
      return todo?.map((key) => tasks[key]);
    });
  } else {
    // hits here when running yarn build --packagename
    watchMode = process.argv.includes('--watch');
    prodMode = process.argv.includes('--prod');
    selection = Object.keys(tasks)
      .map((key) => tasks[key])
      .filter((item) => !['watch', 'prod'].includes(item.name) && item.value === true);
  }

  selection?.filter(Boolean).forEach(async (v) => {
    const command = (await readJSON(resolve('../code', v.location, 'package.json'))).scripts?.prep
      .split(posix.sep)
      .join(sep);

    if (!command) {
      console.log(`No prep script found for ${v.name}`);
      return;
    }

    const cwd = resolve(__dirname, '..', 'code', v.location);
    const sub = execaCommand(
      `${command}${watchMode ? ' --watch' : ''}${prodMode ? ' --optimized' : ''}`,
      {
        cwd,
        buffer: false,
        shell: true,
        cleanup: true,
        env: {
          NODE_ENV: 'production',
        },
      }
    );

    sub.stdout?.on('data', (data) => {
      process.stdout.write(`${chalk.cyan(v.name)}:\n${data}`);
    });
    sub.stderr?.on('data', (data) => {
      process.stderr.write(`${chalk.red(v.name)}:\n${data}`);
    });
  });
}

run().catch((e) => {
  console.log(e);
  process.exit(1);
});
