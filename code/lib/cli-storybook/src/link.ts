import fse from 'fs-extra';
import path from 'path';
import { sync as spawnSync, spawn as spawnAsync } from 'cross-spawn';
import { logger } from 'storybook/internal/node-logger';
import chalk from 'chalk';

type ExecOptions = Parameters<typeof spawnAsync>[2];

interface LinkOptions {
  target: string;
  local?: boolean;
  start: boolean;
}

// TODO: Extract this to somewhere else, or use `exec` from a different file that might already have it
export const exec = async (
  command: string,
  options: ExecOptions = {},
  {
    startMessage,
    errorMessage,
    dryRun,
  }: { startMessage?: string; errorMessage?: string; dryRun?: boolean } = {}
) => {
  if (startMessage) logger.info(startMessage);

  if (dryRun) {
    logger.info(`\n> ${command}\n`);
    return undefined;
  }

  logger.info(command);
  return new Promise((resolve, reject) => {
    const child = spawnAsync(command, {
      ...options,
      shell: true,
      stdio: 'pipe',
    });

    child.stderr.pipe(process.stdout);
    child.stdout.pipe(process.stdout);

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        logger.error(chalk.red(`An error occurred while executing: \`${command}\``));
        if (errorMessage) {
          logger.info(errorMessage);
        }
        reject(new Error(`command exited with code: ${code}: `));
      }
    });
  });
};

export const link = async ({ target, local, start }: LinkOptions) => {
  const storybookDir = process.cwd();
  try {
    const packageJson = await fse.readJSON('package.json');
    if (packageJson.name !== '@storybook/root') {
      throw new Error();
    }
  } catch {
    throw new Error('Expected to run link from the root of the storybook monorepo');
  }

  let reproDir = target;
  let reproName = path.basename(target);

  if (!local) {
    const reprosDir = path.join(storybookDir, '../storybook-repros');
    logger.info(`Ensuring directory ${reprosDir}`);
    await fse.ensureDir(reprosDir);

    logger.info(`Cloning ${target}`);
    await exec(`git clone ${target}`, { cwd: reprosDir });
    // Extract a repro name from url given as input (take the last part of the path and remove the extension)
    reproName = path.basename(target, path.extname(target));
    reproDir = path.join(reprosDir, reproName);
  }

  const reproPackageJson = await fse.readJSON(path.join(reproDir, 'package.json'));

  const version = spawnSync('yarn', ['--version'], {
    cwd: reproDir,
    stdio: 'pipe',
    shell: true,
  }).stdout.toString();

  if (!/^[2-4]\./.test(version)) {
    logger.warn(`🚨 Expected yarn 2 or higher in ${reproDir}!`);
    logger.warn('');
    logger.warn('Please set it up with `yarn set version berry`,');
    logger.warn(`then link '${reproDir}' with the '--local' flag.`);
    return;
  }

  logger.info(`Linking ${reproDir}`);
  await exec(`yarn link --all --relative ${storybookDir}`, { cwd: reproDir });

  logger.info(`Installing ${reproName}`);
  await exec(`yarn install`, { cwd: reproDir });

  if (!reproPackageJson.devDependencies?.vite) {
    await exec(`yarn add -D webpack-hot-middleware`, { cwd: reproDir });
  }

  // ensure that linking is possible
  await exec(`yarn add @types/node@18`, { cwd: reproDir });

  if (start) {
    logger.info(`Running ${reproName} storybook`);
    await exec(`yarn run storybook`, { cwd: reproDir });
  }
};
