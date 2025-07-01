/* eslint-disable local-rules/no-uncategorized-errors */
import { mkdir, rm } from 'node:fs/promises';

import { join, relative } from 'pathe';
import picocolors from 'picocolors';
import prettyTime from 'pretty-hrtime';

import { buildEntries } from './entries';
import { measure } from './utils';
import { generateDistFiles } from './utils/generate-bundle';
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

  const isProduction =
    flags.includes('--prod') || flags.includes('--production') || flags.includes('--optimized');
  const isWatch = flags.includes('--watch');

  if (isProduction && isWatch) {
    throw new Error('Cannot watch and build for production at the same time');
  }

  const { default: pkg } = await import(join(DIR_CWD, 'package.json'), { with: { type: 'json' } });

  await rm(DIR_DIST, { recursive: true }).catch(() => {});
  await mkdir(DIR_DIST);

  console.log(
    isWatch
      ? `Watching ${picocolors.greenBright(DIR_REL)}`
      : `Building ${picocolors.greenBright(DIR_REL)}`
  );

  const { entries, prebuild } = buildEntries[pkg.name];
  if (!entries) {
    throw new Error(`TODO BETTER ERROR: No build entries found for package ${pkg.name}`);
  }

  let prebuildTime: Awaited<ReturnType<typeof measure>> | undefined;

  if (prebuild) {
    console.log(`Running prebuild script`);
    prebuildTime = await measure(() => prebuild(DIR_CWD));
  }

  await generatePackageJsonFile(DIR_CWD, buildEntries[pkg.name]);
  const dist = measure(async () =>
    generateDistFiles(DIR_CWD, buildEntries[pkg.name], isProduction, isWatch)
  );
  const types = measure(async () => {
    await generateTypesMapperFiles(DIR_CWD, buildEntries[pkg.name]);
    await modifyCoreThemeTypes(DIR_CWD);
    if (isProduction) {
      await generateTypesFiles(DIR_CWD, buildEntries[pkg.name]);
    }
  });

  const [distTime, typesTime] = await Promise.all([dist, types]);

  if (prebuildTime) {
    console.log(`Prebuild script completed in`, picocolors.yellow(prettyTime(prebuildTime)));
  }

  console.log(
    isWatch ? 'Watcher started in' : 'Bundled in',
    picocolors.yellow(prettyTime(distTime))
  );
  console.log(
    isProduction ? 'Generated types in' : 'Generated type mappers in',
    picocolors.yellow(prettyTime(typesTime))
  );
}

run();
