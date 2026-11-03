import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { program } from 'commander';
// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import picocolors from 'picocolors';
import semver from 'semver';
import { dedent } from 'ts-dedent';
import { z } from 'zod';

import { esMain } from '../utils/esmain.ts';
import { getCodeWorkspaces } from '../utils/workspace.ts';
import {
  listUnpublishedPackages,
  packagesAcceptedByRegistry,
  packagesNotUploaded,
  waitForPackagesToBePublished,
} from './npm-registry.ts';

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

const CODE_DIR_PATH = join(__dirname, '..', '..', 'code');
const CODE_PACKAGE_JSON_PATH = join(CODE_DIR_PATH, 'package.json');

type AttemptClass = 'registry' | 'signing';

const ATTEMPT_BUDGETS: Record<AttemptClass, number> = { registry: 3, signing: 10 };
const SIGNING_BACKOFF_MS = 20_000;
const REGISTRY_POLL_INTERVAL_MS = 15_000;
const REGISTRY_POLL_TIMEOUT_MS = 15 * 60 * 1000;

const validateOptions = (options: unknown): options is Options => {
  optionsSchema.parse(options);
  return true;
};

const getCurrentVersion = async (verbose?: boolean) => {
  if (verbose) {
    console.log(`📐 Reading current version of Storybook...`);
  }
  const content = await readFile(CODE_PACKAGE_JSON_PATH, 'utf-8');
  const { version } = JSON.parse(content);
  console.log(`📐 Current version of Storybook is ${picocolors.green(version)}`);
  return version;
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

export const publishCommand = (tag: string, packageNames: string[]) => {
  const include = packageNames.map((name) => `--include=${name}`).join(' ');
  return `yarn workspaces foreach --all --parallel --no-private ${include} --verbose npm publish --provenance --tolerate-republish --tag ${tag}`;
};

const execaOutput = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return '';
  }
  const { stdout, stderr, all } = error as { stdout?: string; stderr?: string; all?: string };
  return [all, stdout, stderr].filter(Boolean).join('\n');
};

export const publishAllPackages = async ({
  tag,
  verbose,
  dryRun,
  currentVersion,
  packageNames,
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}: {
  tag: string;
  verbose?: boolean;
  dryRun?: boolean;
  currentVersion: string;
  packageNames: string[];
  sleep?: (ms: number) => Promise<void>;
}) => {
  console.log(`📦 Publishing all packages...`);
  if (dryRun) {
    console.log(`📦 Dry run, skipping publish. Would have executed:
    ${picocolors.blue(publishCommand(tag, packageNames))}`);
    return;
  }

  // Staged versions are reserved but not in the packument yet; a retry PUT 409s.
  let toPublish = [...packageNames];
  let unpublished = [...packageNames];
  const accepted = new Set<string>();
  let lastError: unknown;
  const attemptsUsed: Record<AttemptClass, number> = { registry: 0, signing: 0 };

  for (;;) {
    const command = publishCommand(tag, toPublish);
    if (verbose) {
      console.log(`📦 Executing: ${command}`);
    }

    try {
      await execaCommand(command, {
        cleanup: true,
        cwd: CODE_DIR_PATH,
        stdout: ['pipe', 'inherit'],
        stderr: ['pipe', 'inherit'],
      });
      console.log(`📦 Packages successfully published`);
      return;
    } catch (error) {
      lastError = error;
      const output = execaOutput(error);
      for (const name of packagesAcceptedByRegistry(output)) {
        accepted.add(name);
      }
      toPublish = toPublish.filter((name) => !accepted.has(name));

      unpublished = await listUnpublishedPackages({
        packageNames,
        version: currentVersion,
        verbose,
      });

      if (unpublished.length === 0) {
        console.log(
          `📦 All packages are on npm even though Yarn exited non-zero (registry lag after a staged 409). Treating as success.`
        );
        return;
      }

      // A tlog failure happens before the registry PUT, so nothing is staged: https://github.com/yarnpkg/berry/issues/7308
      const notUploaded = new Set(packagesNotUploaded(output));
      const attemptClass: AttemptClass = unpublished.every((name) => notUploaded.has(name))
        ? 'signing'
        : 'registry';
      attemptsUsed[attemptClass] += 1;
      const attempt = attemptsUsed[attemptClass];
      const retriesLeft = ATTEMPT_BUDGETS[attemptClass] - attempt;

      if (attemptClass === 'signing') {
        console.log(
          picocolors.yellow(
            dedent`❗ ${unpublished.length} package(s) failed in Sigstore before upload: ${unpublished.join(', ')}
            This was attempt number ${attempt}, there are ${retriesLeft} retries left.`
          )
        );
      } else {
        console.log(
          picocolors.yellow(
            dedent`❗ ${unpublished.length} package(s) are not yet visible on npm: ${unpublished.join(', ')}
            This was attempt number ${attempt}, there are ${retriesLeft} retries left.
            Waiting for the registry instead of publishing over a staged version.`
          )
        );

        unpublished = await waitForPackagesToBePublished({
          packageNames: unpublished,
          version: currentVersion,
          timeoutMs: REGISTRY_POLL_TIMEOUT_MS,
          intervalMs: REGISTRY_POLL_INTERVAL_MS,
          verbose,
        });

        if (unpublished.length === 0) {
          console.log(`📦 All packages became visible on npm. Treating as success.`);
          return;
        }
      }

      toPublish = unpublished.filter((name) => !accepted.has(name));
      if (toPublish.length === 0) {
        throw new Error(
          `Failed to publish version ${currentVersion}. Still missing after staging wait: ${unpublished.join(', ')}`,
          { cause: lastError }
        );
      }

      if (retriesLeft === 0) {
        break;
      }

      if (attemptClass === 'signing') {
        console.log(
          picocolors.yellow(`❗ Retrying ${toPublish.join(', ')} in ${SIGNING_BACKOFF_MS / 1000}s.`)
        );
        await sleep(SIGNING_BACKOFF_MS);
      } else {
        console.log(
          picocolors.yellow(
            `❗ Still missing ${toPublish.join(', ')}. Retrying publish for those packages only.`
          )
        );
      }
    }
  }

  throw new Error(
    `Failed to publish version ${currentVersion}. Still missing: ${unpublished.join(', ')}`,
    { cause: lastError }
  );
};

export const run = async (options: unknown) => {
  if (!validateOptions(options)) {
    return;
  }
  const { tag, dryRun, verbose } = options;

  const currentVersion = await getCurrentVersion(verbose);
  const workspaces = await getCodeWorkspaces(false);
  const packageNames = workspaces.map((workspace) => workspace.name);
  const unpublished = await listUnpublishedPackages({
    packageNames,
    version: currentVersion,
    verbose,
  });

  if (unpublished.length === 0) {
    console.log(
      `✅ All packages already published at ${picocolors.green(currentVersion)}, skipping publish`
    );
    return;
  }

  await buildAllPackages();
  await publishAllPackages({
    tag,
    verbose,
    dryRun,
    currentVersion,
    packageNames: unpublished,
  });

  console.log(
    `✅ Published all packages with version ${picocolors.green(currentVersion)}${
      tag ? ` at tag ${picocolors.blue(tag)}` : ''
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
