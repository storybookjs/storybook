/**
 * This is the entrypoint to compile a singular package:
 *
 * This is not run directly, but rather through the `nr task compile` or `nr build <package-name>`
 * commands.
 *
 * It is used to compile a package, and generate the dist files, type mappers, and types files.
 *
 * The `process.cwd()` is the root of the current package to be built.
 */

/* eslint-disable local-rules/no-uncategorized-errors */
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { join, relative } from 'pathe';
import picocolors from 'picocolors';
import prettyTime from 'pretty-hrtime';

import { ROOT_DIRECTORY } from '../utils/constants';
import { buildEntries, hasPrebuild, isBuildEntries } from './entry-configs';
import { measure } from './utils/entry-utils';
import { generateBundle } from './utils/generate-bundle';
import { generatePackageJsonFile } from './utils/generate-package-json';
import { generateTypesFiles } from './utils/generate-types';

const {
  values: { prod, production, optimized, watch, cwd },
} = parseArgs({
  options: {
    prod: { type: 'boolean', default: false },
    production: { type: 'boolean', default: false },
    optimized: { type: 'boolean', default: false },
    watch: { type: 'boolean', default: false },
    cwd: { type: 'string' },
  },
  allowNegative: true,
});

async function run() {
  const DIR_ROOT = join(import.meta.dirname, '..', '..');
  const DIR_CWD = cwd ? join(ROOT_DIRECTORY, cwd) : process.cwd();
  const DIR_DIST = join(DIR_CWD, 'dist');
  const DIR_REL = relative(DIR_ROOT, DIR_CWD);

  const isProduction = prod || production || optimized;
  const isWatch = watch;

  if (isProduction && isWatch) {
    throw new Error('Cannot watch and build for production at the same time');
  }

  const { default: pkg } = await import(pathToFileURL(join(DIR_CWD, 'package.json')).href, {
    with: { type: 'json' },
  });

  await rm(DIR_DIST, { recursive: true }).catch(() => {});
  await mkdir(DIR_DIST);

  console.log(
    isWatch
      ? `Watching ${picocolors.greenBright(DIR_REL)}`
      : `Building ${picocolors.greenBright(DIR_REL)}`
  );

  const name = pkg.name;

  if (!isBuildEntries(name)) {
    throw new Error(`TODO BETTER ERROR: No build entries found for package ${pkg.name}`);
  }

  const entry = buildEntries[name];

  let prebuildTime: Awaited<ReturnType<typeof measure>> | undefined;

  if (hasPrebuild(entry)) {
    console.log(`Running prebuild script`);
    prebuildTime = await measure(() => entry.prebuild(DIR_CWD));
  }

  await generatePackageJsonFile(DIR_CWD, entry);

  const [bundleTime, typesTime] = await Promise.all([
    measure(async () => generateBundle({ cwd: DIR_CWD, entry, name, isWatch })),
    measure(async () => {
      if (isProduction) {
        await generateTypesFiles(DIR_CWD, entry);
      }
    }),
  ]);

  if (prebuildTime) {
    console.log(`Prebuild script completed in`, picocolors.yellow(prettyTime(prebuildTime)));
  }

  console.log(
    isWatch ? 'Watcher started in' : 'Bundled in',
    picocolors.yellow(prettyTime(bundleTime))
  );
  console.log(
    isProduction ? 'Generated types in' : 'Generated type mappers in',
    picocolors.yellow(prettyTime(typesTime))
  );
}

run();
