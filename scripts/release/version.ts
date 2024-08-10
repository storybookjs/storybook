import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { setOutput } from '@actions/core';
import { readJson, writeJson } from '@ndelangen/fs-extra-unified';
import chalk from 'chalk';
import program from 'commander';
import { execaCommand } from 'execa';
import semver from 'semver';
import { z } from 'zod';

import { esMain } from '../utils/esmain';
import type { Workspace } from '../utils/workspace';
import { getWorkspaces } from '../utils/workspace';

program
  .name('version')
  .description('version all packages')
  .option(
    '-R, --release-type <major|minor|patch|prerelease>',
    'Which release type to use to bump the version'
  )
  .option(
    '-P, --pre-id <id>',
    'Which prerelease identifier to change to, eg. "alpha", "beta", "rc"'
  )
  .option(
    '-E, --exact <version>',
    'Use exact version instead of calculating from current version, eg. "7.2.0-canary.123". Can not be combined with --release-type or --pre-id'
  )
  .option(
    '-D, --deferred',
    'Do not bump versions everywhere, instead set it in code/package.json#deferredNextVersion'
  )
  .option('-A, --apply', 'Apply a deferred version bump')
  .option('-V, --verbose', 'Enable verbose logging', false);

const optionsSchema = z
  .object({
    releaseType: z
      .enum(['major', 'minor', 'patch', 'prerelease', 'premajor', 'preminor', 'prepatch'])
      .optional(),
    preId: z.string().optional(),
    exact: z
      .string()
      .optional()
      .refine((version) => (version ? semver.valid(version) !== null : true), {
        message: '--exact version has to be a valid semver string',
      }),
    deferred: z.boolean().optional(),
    apply: z.boolean().optional(),
    verbose: z.boolean().optional(),
  })
  .superRefine((schema, ctx) => {
    // manual union validation because zod + commander is not great in this case
    const hasExact = 'exact' in schema && schema.exact;
    const hasReleaseType = 'releaseType' in schema && schema.releaseType;
    const hasDeferred = 'deferred' in schema && schema.deferred;
    const hasApply = 'apply' in schema && schema.apply;
    if (hasDeferred && hasApply) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '--deferred cannot be combined with --apply',
      });
    }
    if (hasApply && (hasExact || hasReleaseType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          '--apply cannot be combined with --exact or --release-type, as it will always read from code/package.json#deferredNextVersion',
      });
    }
    if (!hasApply && ((hasExact && hasReleaseType) || (!hasExact && !hasReleaseType))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Combining --exact with --release-type is invalid, but having one of them is required',
      });
    }
    if (schema.preId && !schema.releaseType.startsWith('pre')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Using prerelease identifier requires one of release types: premajor, preminor, prepatch, prerelease',
      });
    }
    return z.NEVER;
  });

type BaseOptions = { verbose: boolean };
type BumpOptions = BaseOptions & {
  releaseType: semver.ReleaseType;
  preId?: string;
  deferred?: boolean;
};
type ExactOptions = BaseOptions & {
  exact: semver.ReleaseType;
  deferred?: boolean;
};
type ApplyOptions = BaseOptions & {
  apply: boolean;
};
type Options = BumpOptions | ExactOptions | ApplyOptions;

const CODE_DIR_PATH = path.join(__dirname, '..', '..', 'code');
const CODE_PACKAGE_JSON_PATH = path.join(CODE_DIR_PATH, 'package.json');

const validateOptions = (options: { [key: string]: any }): options is Options => {
  optionsSchema.parse(options);
  return true;
};

const getCurrentVersion = async () => {
  console.log(`📐 Reading current version of Storybook...`);
  const { version } = await readJson(CODE_PACKAGE_JSON_PATH);
  return version;
};

const bumpCodeVersion = async (nextVersion: string) => {
  console.log(`🤜 Bumping version of ${chalk.cyan('code')}'s package.json...`);

  const codePkgJson = await readJson(CODE_PACKAGE_JSON_PATH);

  codePkgJson.version = nextVersion;
  await writeJson(CODE_PACKAGE_JSON_PATH, codePkgJson, { spaces: 2 });

  console.log(`✅ Bumped version of ${chalk.cyan('code')}'s package.json`);
};

const bumpVersionSources = async (currentVersion: string, nextVersion: string) => {
  const filesToUpdate = [
    path.join(CODE_DIR_PATH, 'core', 'src', 'manager-api', 'version.ts'),
    path.join(CODE_DIR_PATH, 'core', 'src', 'common', 'versions.ts'),
  ];
  console.log(`🤜 Bumping versions in...:\n  ${chalk.cyan(filesToUpdate.join('\n  '))}`);

  await Promise.all(
    filesToUpdate.map(async (filename) => {
      const currentContent = await readFile(filename, { encoding: 'utf-8' });
      const nextContent = currentContent.replaceAll(currentVersion, nextVersion);
      return writeFile(filename, nextContent);
    })
  );

  console.log(`✅ Bumped versions in:\n  ${chalk.cyan(filesToUpdate.join('\n  '))}`);
};

const bumpAllPackageJsons = async ({
  packages,
  nextVersion,
  verbose,
}: {
  packages: Workspace[];
  nextVersion: string;
  verbose?: boolean;
}) => {
  console.log(
    `🤜 Bumping versions and dependencies in ${chalk.cyan(
      `all ${packages.length} package.json`
    )}'s...`
  );
  // 1. go through all packages in the monorepo
  await Promise.all(
    packages.map(async (pkg) => {
      // 2. get the package.json
      const packageJsonPath = path.join(CODE_DIR_PATH, pkg.location, 'package.json');
      const packageJson: {
        version: string;
        [key: string]: any;
      } = await readJson(packageJsonPath);
      // 3. bump the version
      packageJson.version = nextVersion;
      if (verbose) {
        console.log(
          `    Bumping ${chalk.blue(pkg.name)}'s version to ${chalk.yellow(nextVersion)}`
        );
      }
      await writeJson(packageJsonPath, packageJson, { spaces: 2 });
    })
  );
};

const bumpDeferred = async (nextVersion: string) => {
  console.log(
    `⏳ Setting a ${chalk.cyan('deferred')} version bump with ${chalk.blue(
      'code/package.json#deferredNextVersion'
    )} = ${chalk.yellow(nextVersion)}...`
  );
  const codePkgJson = await readJson(CODE_PACKAGE_JSON_PATH);

  if (codePkgJson.deferredNextVersion) {
    console.warn(
      `❗ A "deferredNextVersion" property already exists with the value of ${chalk.cyan(
        codePkgJson.deferredNextVersion
      )}. This will be overwritten and ignored.`
    );
  }

  codePkgJson.deferredNextVersion = nextVersion;
  await writeJson(CODE_PACKAGE_JSON_PATH, codePkgJson, { spaces: 2 });

  console.log(`✅ Set a ${chalk.cyan('deferred')} version bump. Not bumping any packages.`);
};

const applyDeferredVersionBump = async () => {
  console.log(
    `⏩ Applying previously deferred version bump set at ${chalk.blue(
      'code/package.json#deferredNextVersion'
    )}...`
  );
  const codePkgJson = await readJson(CODE_PACKAGE_JSON_PATH);

  const { deferredNextVersion } = codePkgJson;

  if (!deferredNextVersion) {
    throw new Error(
      "The 'deferredNextVersion' property in code/package.json is unset. This is necessary to apply a deferred version bump"
    );
  }

  delete codePkgJson.deferredNextVersion;
  await writeJson(CODE_PACKAGE_JSON_PATH, codePkgJson, { spaces: 2 });

  console.log(
    `✅ Extracted and removed deferred version ${chalk.green(
      deferredNextVersion
    )} from ${chalk.blue('code/package.json#deferredNextVersion')}`
  );

  return deferredNextVersion;
};

export const run = async (options: unknown) => {
  if (!validateOptions(options)) {
    return;
  }
  const { verbose } = options;

  console.log(`🚛 Finding Storybook packages...`);

  const [packages, currentVersion] = await Promise.all([getWorkspaces(), getCurrentVersion()]);

  console.log(
    `📦 found ${packages.length} storybook packages at version ${chalk.red(currentVersion)}`
  );
  if (verbose) {
    const formattedPackages = packages.map(
      (pkg) => `${chalk.green(pkg.name.padEnd(60))}: ${chalk.cyan(pkg.location)}`
    );
    console.log(`📦 Packages:
        ${formattedPackages.join('\n    ')}`);
  }

  let nextVersion: string;

  if ('apply' in options && options.apply) {
    nextVersion = await applyDeferredVersionBump();
  } else if ('exact' in options && options.exact) {
    console.log(`📈 Exact version selected: ${chalk.green(options.exact)}`);
    nextVersion = options.exact;
  } else {
    const { releaseType, preId } = options as BumpOptions;
    console.log(`📈 Release type selected: ${chalk.green(releaseType)}`);
    if (preId) {
      console.log(`🆔 Version prerelease identifier selected: ${chalk.yellow(preId)}`);
    }

    nextVersion = semver.inc(currentVersion, releaseType, preId);

    console.log(
      `⏭ Bumping version ${chalk.blue(currentVersion)} with release type ${chalk.green(
        releaseType
      )}${
        preId ? ` and ${chalk.yellow(preId)}` : ''
      } results in version: ${chalk.bgGreenBright.bold(nextVersion)}`
    );
  }

  if ('deferred' in options && options.deferred) {
    await bumpDeferred(nextVersion);
  } else {
    console.log(`⏭ Bumping all packages to ${chalk.blue(nextVersion)}...`);

    await bumpCodeVersion(nextVersion);
    await bumpVersionSources(currentVersion, nextVersion);
    await bumpAllPackageJsons({ packages, nextVersion, verbose });

    console.log(`⬆️ Updating lock file with ${chalk.blue('yarn install --mode=update-lockfile')}`);
    await execaCommand(`yarn install --mode=update-lockfile`, {
      cwd: path.join(CODE_DIR_PATH),
      stdio: verbose ? 'inherit' : undefined,
      cleanup: true,
    });
    console.log(`✅ Updated lock file with ${chalk.blue('yarn install --mode=update-lockfile')}`);
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('current-version', currentVersion);
    setOutput('next-version', nextVersion);
  }
};

if (esMain(import.meta.url)) {
  const options = program.parse().opts();
  run(options).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
