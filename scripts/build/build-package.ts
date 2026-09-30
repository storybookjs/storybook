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

import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { join, relative } from 'pathe';
import picocolors from 'picocolors';
import prettyTime from 'pretty-hrtime';

import { type BuildEntries, measure } from './utils/entry-utils.ts';
import { generateBundle } from './utils/generate-bundle.ts';
import { generatePackageJsonFile } from './utils/generate-package-json.ts';

const {
  values: {
    prod,
    production,
    optimized,
    watch,
    cwd,
    'dts-bundler': dtsBundler,
    'dts-resolver': dtsResolver,
  },
} = parseArgs({
  options: {
    prod: { type: 'boolean', default: false },
    production: { type: 'boolean', default: false },
    optimized: { type: 'boolean', default: false },
    watch: { type: 'boolean', default: false },
    cwd: { type: 'string' },
    'dts-bundler': { type: 'string', default: 'rolldown-tsgo' },
    'dts-resolver': { type: 'string', default: 'hybrid' },
  },
  allowNegative: true,
});

if (dtsResolver !== 'tsc' && dtsResolver !== 'oxc' && dtsResolver !== 'hybrid') {
  throw new Error(`Invalid --dts-resolver: ${dtsResolver} (expected 'hybrid', 'tsc' or 'oxc')`);
}
const resolvedDtsResolver: 'tsc' | 'oxc' | 'hybrid' = dtsResolver;

async function run() {
  const DIR_ROOT = join(import.meta.dirname, '..', '..');
  const DIR_CWD = cwd ? join(DIR_ROOT, cwd) : process.cwd();
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

  // Only this package's config: importing the entry-configs.ts registry would load all of them.
  const { default: entry } = (await import(
    pathToFileURL(join(DIR_CWD, 'build-config.ts')).href
  )) as { default: BuildEntries };

  let prebuildTime: Awaited<ReturnType<typeof measure>> | undefined;

  if (entry.prebuild) {
    const { prebuild } = entry;
    console.log(`Running prebuild script`);
    prebuildTime = await measure(() => prebuild(DIR_CWD));
  }

  await generatePackageJsonFile(DIR_CWD, entry);

  const [bundleTime, typesTime] = await Promise.all([
    measure(async () => generateBundle({ cwd: DIR_CWD, entry, name, isWatch })),
    // The d.ts toolchain (typescript, rolldown, rolldown-plugin-dts) is imported lazily: dev
    // builds never need it, and in production its import no longer delays the esbuild start.
    measure(async () => {
      if (!isProduction) {
        return;
      }
      const bundler = entry.dtsBundler ?? dtsBundler;
      if (bundler === 'rolldown' || bundler === 'rolldown-tsgo') {
        const { generateTypesFiles } = await import('./utils/generate-types-rolldown.ts');
        await generateTypesFiles(DIR_CWD, entry, {
          tsgo: bundler === 'rolldown-tsgo',
          resolver: resolvedDtsResolver,
        });
      } else {
        const { generateTypesFiles } = await import('./utils/generate-types.ts');
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
