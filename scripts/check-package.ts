// This script makes sure that we can support type checking,
// without having to build dts files for all packages in the monorepo.
// It is not implemented yet for angular, svelte and vue.
import { join } from 'node:path';
import { relative } from 'node:path';

import { program } from 'commander';
// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import { resolve } from 'path';
import picocolors from 'picocolors';
import prompts from 'prompts';
import Watchpack from 'watchpack';
import windowSize from 'window-size';

import { getTSFilesAndConfig } from './check/utils/typescript';
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

  if (watchMode) {
    // In watch mode, collect all files from all packages and watch them together
    const allFiles: string[] = [];
    const packageInfos: Array<{
      name: string;
      location: string;
      cwd: string;
      tsconfigPath: string;
    }> = [];

    selection.forEach((v) => {
      const cwd = resolve(__dirname, '..', 'code', v.location);
      const tsconfigPath = join(cwd, 'tsconfig.json');

      try {
        const { fileNames } = getTSFilesAndConfig(tsconfigPath, cwd);
        allFiles.push(...fileNames, tsconfigPath);
        packageInfos.push({ name: v.name, location: v.location, cwd, tsconfigPath });
      } catch (error) {
        process.stderr.write(`${picocolors.red('Error loading')} ${v.name}: ${error}\n`);
      }
    });

    const wp = new Watchpack({
      aggregateTimeout: 200,
    });

    async function runAllChecks() {
      const timestamp = new Date().toLocaleTimeString();
      process.stdout.write(
        `\n${picocolors.dim(`[${timestamp}]`)} Checking packages: ${packageInfos.map((p) => picocolors.cyan(p.name)).join(', ')}...\n`
      );

      for (const v of packageInfos) {
        const script = join(ROOT_DIRECTORY, 'scripts', 'check', 'check-package.ts');
        const command = `yarn exec jiti ${script}`;

        try {
          const sub = await execaCommand(command, {
            cwd: v.cwd,
            env: {
              NODE_ENV: 'production',
            },
          });

          if (sub.stdout) {
            const prefix = `\n\n${picocolors.cyan(v.name)}:\n`;
            process.stdout.write(prefix);
            process.stdout.write(sub.stdout);
          }
        } catch (error: any) {
          const prefix = `\n\n${picocolors.cyan(v.name)}:\n`;
          process.stdout.write(prefix);
          if (error.stdout) {
            process.stdout.write(error.stdout);
          }
          if (error.stderr) {
            process.stderr.write(error.stderr);
          }
        }
      }

      process.stdout.write(`${picocolors.dim('\n\nWatching for changes...')}\n`);
    }

    // Run initial check then watch all files
    runAllChecks();
    wp.watch({
      files: allFiles,
      missing: [],
      startTime: Date.now(),
    });
    wp.on('change', (filePath: string) => {
      process.stdout.write(
        `\n${picocolors.yellow('File changed:')} ${picocolors.cyan(relative(ROOT_DIRECTORY, filePath))}\n`
      );
      runAllChecks();
    });

    process.on('SIGINT', () => {
      wp.close();
      process.exit(0);
    });
  } else {
    // If watch mode is off, check each individual package sequentially.
    selection.forEach(async (v) => {
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
}

run().catch((e) => {
  process.stderr.write(`${e.toString()}\n`);
  process.exit(1);
});
