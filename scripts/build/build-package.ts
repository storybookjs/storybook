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
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { join, relative } from 'pathe';
import picocolors from 'picocolors';
import prettyTime from 'pretty-hrtime';

import { buildEntries, hasPrebuild, isBuildEntries } from './entry-configs';
import { measure } from './utils/entry-utils';
import { generateBundle } from './utils/generate-bundle';
import { generatePackageJsonFile } from './utils/generate-package-json';
import { generateTypesMapperFiles } from './utils/generate-type-mappers';
import { generateTypesFiles } from './utils/generate-types';
import { modifyCoreThemeTypes } from './utils/modify-core-theme-types';

async function run() {
  const flags = process.argv.slice(2);
  const DIR_ROOT = join(import.meta.dirname, '..', '..');
  const DIR_CWD = process.cwd();
  const DIR_DIST = join(DIR_CWD, 'dist');
  const DIR_REL = relative(DIR_ROOT, DIR_CWD);

  if (process.env.SKIP_COMPILE && existsSync(join(DIR_DIST))) {
    console.log('Skipping re-compiling due to SKIP_COMPILE env var');
    return;
  }

  const isProduction =
    flags.includes('--prod') || flags.includes('--production') || flags.includes('--optimized');
  const isWatch = flags.includes('--watch');

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
      await generateTypesMapperFiles(DIR_CWD, entry);
      await modifyCoreThemeTypes(DIR_CWD);
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
