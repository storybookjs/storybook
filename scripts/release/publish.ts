import chalk from 'chalk';
import program from 'commander';
import { execaCommand } from 'execa';
import { readJson } from 'fs-extra';
import pRetry from 'p-retry';
import path from 'path';
import semver from 'semver';
import dedent from 'ts-dedent';
import { z } from 'zod';

import { esMain } from '../utils/esmain';

program
  .name('publish')
  .description('publish all packages')
  .requiredOption(
    '-T, --tag <tag>',
    'Specify which distribution tag to set for the version being published. Required, since leaving it undefined would publish with the "latest" tag'
  )
  .option('-D, --dry-run', 'Do not publish, only output to shell', false)
  .option('-V, --verbose', 'Enable verbose logging', false);

const optionsSchema = z
  .object({
    tag: z.string(),
    verbose: z.boolean().optional(),
    dryRun: z.boolean().optional(),
  })
  .refine((schema) => (schema.tag ? !semver.valid(schema.tag) : true), {
    message:
      'The tag can not be a valid semver version, it must be a plain string like "next" or "latest"',
  });

type Options = {
  tag: string;
  verbose: boolean;
  dryRun?: boolean;
};

const CODE_DIR_PATH = path.join(__dirname, '..', '..', 'code');
const CODE_PACKAGE_JSON_PATH = path.join(CODE_DIR_PATH, 'package.json');

const validateOptions = (options: { [key: string]: any }): options is Options => {
  optionsSchema.parse(options);
  return true;
};

const getCurrentVersion = async (verbose?: boolean) => {
  if (verbose) {
    console.log(`📐 Reading current version of Storybook...`);
  }
  const { version } = await readJson(CODE_PACKAGE_JSON_PATH);
  console.log(`📐 Current version of Storybook is ${chalk.green(version)}`);
  return version;
};

const isCurrentVersionPublished = async ({
  packageName,
  currentVersion,
  verbose,
}: {
  packageName: string;
  currentVersion: string;
  verbose?: boolean;
}) => {
  const prettyPackage = `${chalk.blue(packageName)}@${chalk.green(currentVersion)}`;
  console.log(`⛅ Checking if ${prettyPackage} is published...`);

  if (verbose) {
    console.log(`Fetching from npm:`);
    console.log(
      `https://registry.npmjs.org/${chalk.blue(packageName)}/${chalk.green(currentVersion)}`
    );
  }
  const response = await fetch(`https://registry.npmjs.org/${packageName}/${currentVersion}`);
  if (response.status === 404) {
    console.log(`🌤️ ${prettyPackage} is not published`);
    return false;
  }
  if (response.status !== 200) {
    console.error(
      `Unexpected status code when checking the current version on npm: ${response.status}`
    );
    console.error(await response.text());
    throw new Error(
      `Unexpected status code when checking the current version on npm: ${response.status}`
    );
  }
  const data = await response.json();
  if (verbose) {
    console.log(`Response from npm:`);
    console.log(data);
  }
  if (data.version !== currentVersion) {
    // this should never happen
    console.error(
      `Unexpected version received when checking the current version on npm: ${data.version}`
    );
    console.error(JSON.stringify(data, null, 2));
    throw new Error(
      `Unexpected version received when checking the current version on npm: ${data.version}`
    );
  }

  console.log(`⛈️ ${prettyPackage} is published`);
  return true;
};

const buildAllPackages = async () => {
  console.log(`🏗️ Building all packages...`);
  await execaCommand('yarn task --task=compile --start-from=compile --no-link', {
    stdio: 'inherit',
    cleanup: true,
    cwd: CODE_DIR_PATH,
  });
  console.log(`🏗️ Packages successfully built`);
};

const publishAllPackages = async ({
  tag,
  verbose,
  dryRun,
}: {
  tag: string;
  verbose?: boolean;
  dryRun?: boolean;
}) => {
  console.log(`📦 Publishing all packages...`);
  const command = `yarn workspaces foreach --all --parallel --no-private --verbose npm publish --tolerate-republish --tag ${tag}`;
  if (verbose) {
    console.log(`📦 Executing: ${command}`);
  }
  if (dryRun) {
    console.log(`📦 Dry run, skipping publish. Would have executed:
    ${chalk.blue(command)}`);
    return;
  }

  /**
   * 'yarn npm publish' will fail if just one package fails to publish.
   * But it will continue through with all the other packages, and --tolerate-republish makes it okay to publish the same version again.
   * So we can safely retry the whole publishing process if it fails.
   * It's not uncommon for the registry to fail often, which Yarn catches by checking the registry after a package has been published.
   */
  await pRetry(
    () =>
      execaCommand(command, {
        stdio: 'inherit',
        cleanup: true,
        cwd: CODE_DIR_PATH,
      }),
    {
      retries: 4,
      onFailedAttempt: (error) =>
        console.log(
          chalk.yellow(
            dedent`❗One or more packages failed to publish, retrying...
            This was attempt number ${error.attemptNumber}, there are ${error.retriesLeft} retries left. 🤞`
          )
        ),
    }
  );
  console.log(`📦 Packages successfully published`);
};

export const run = async (options: unknown) => {
  if (!validateOptions(options)) {
    return;
  }
  const { tag, dryRun, verbose } = options;

  // Get the current version from code/package.json
  const currentVersion = await getCurrentVersion(verbose);
  const isAlreadyPublished = await isCurrentVersionPublished({
    currentVersion,
    packageName: '@storybook/core',
    verbose,
  });
  if (isAlreadyPublished) {
    throw new Error(
      `⛔ Current version (${chalk.green(currentVersion)}) is already published, aborting.`
    );
  }
  await buildAllPackages();
  await publishAllPackages({ tag, verbose, dryRun });

  console.log(
    `✅ Published all packages with version ${chalk.green(currentVersion)}${
      tag ? ` at tag ${chalk.blue(tag)}` : ''
    }`
  );
};

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  run(parsed.opts()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
