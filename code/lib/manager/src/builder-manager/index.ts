import './hooks.ts';

import { cp, rm, writeFile } from 'node:fs/promises';

import { logger } from '@storybook/core/internal/node-logger';

import { join, parse } from 'pathe';

import { serveBuildOutput } from '@storybook/core/internal/deep/common/utils/server-statics';
import { resolvePackageDir } from '@storybook/core/internal/deep/utils/module';
import type {
  BuilderBuildResult,
  BuilderFunction,
  BuilderStartResult,
  Compilation,
  ManagerBuilder,
  StarterFunction,
} from './types.ts';
import { getManagerConfig } from './utils/config.ts';
import { getData } from './utils/data.ts';
import { readOrderedFiles } from './utils/files.ts';
import { buildFrameworkGlobalsFromOptions } from './utils/framework.ts';
import { renderHTML } from './utils/template.ts';

export { createManagerHost, type ManagerHost } from './host.ts';

export {
  BROWSER_TARGETS,
  NODE_TARGET,
} from '@storybook/core/internal/deep/constants/environments-support';

const CORE_DIR_ORIGIN = join(resolvePackageDir('@storybook/manager', import.meta.url), 'dist/ui');

const isRootPath = /^\/($|\?)/;
let compilation: Compilation;
let asyncIterator: ReturnType<StarterFunction> | ReturnType<BuilderFunction>;

export const getConfig: ManagerBuilder['getConfig'] = async (options) => {
  const [managerEntriesFromPresets, envs] = await Promise.all([
    options.presets.apply('managerEntries', []),
    options.presets.apply<Record<string, string>>('env'),
  ]);
  return getManagerConfig(options, managerEntriesFromPresets, envs);
};

export const executor = {
  get: async () => {
    const { build } = await import('esbuild');
    return build;
  },
};

/**
 * This function is a generator so that we can abort it mid process in case of failure coming from
 * other processes e.g. preview builder
 *
 * I am sorry for making you read about generators today :')
 */
const starter: StarterFunction = async function* starterGeneratorFn({
  startTime,
  options,
  router,
}) {
  if (!options.quiet) {
    logger.info('Starting...');
  }

  const {
    config,
    favicon,
    customHead,
    features,
    instance,
    refs,
    template,
    title,
    logLevel,
    docsOptions,
    tagsOptions,
  } = await getData(options);

  yield;

  // make sure we clear output directory of addons dir before starting
  // this could cause caching issues where addons are loaded when they shouldn't
  const addonsDir = config.outdir;
  await rm(addonsDir, { recursive: true, force: true });

  yield;

  compilation = await instance({
    ...config,
  });

  yield;

  router.use('/sb-addons', serveBuildOutput(addonsDir));
  router.use('/sb-manager', serveBuildOutput(CORE_DIR_ORIGIN));

  const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, compilation?.outputFiles);

  if (compilation.metafile && options.outputDir) {
    await writeFile(
      join(options.outputDir, 'metafile.json'),
      JSON.stringify(compilation.metafile, null, 2)
    );
  }

  // Build additional global values
  const globals: Record<string, any> = await buildFrameworkGlobalsFromOptions(options);

  yield;

  const html = await renderHTML(
    template,
    title,
    favicon,
    customHead,
    cssFiles,
    jsFiles,
    features,
    refs,
    logLevel,
    docsOptions,
    tagsOptions,
    options,
    globals
  );

  yield;

  router.use('/', ({ url }, res, next) => {
    if (url && isRootPath.test(url)) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      res.write(html);
      res.end();
    } else {
      next();
    }
  });
  router.use(`/index.html`, (req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.write(html);
    res.end();
  });

  return {
    bail,
    stats: {
      toJson: () => ({}),
    },
    totalTime: process.hrtime(startTime),
  } as BuilderStartResult;
};

/**
 * This function is a generator so that we can abort it mid process in case of failure coming from
 * other processes e.g. preview builder
 *
 * I am sorry for making you read about generators today :')
 */
const builder: BuilderFunction = async function* builderGeneratorFn({ startTime, options }) {
  if (!options.outputDir) {
    throw new Error('outputDir is required');
  }
  logger.step('Building manager..');
  const {
    config,
    customHead,
    favicon,
    features,
    instance,
    refs,
    template,
    title,
    logLevel,
    docsOptions,
    tagsOptions,
  } = await getData(options);
  yield;

  const addonsDir = config.outdir;
  const coreDirTarget = join(options.outputDir, `sb-manager`);

  // TODO: this doesn't watch, we should change this to use the esbuild watch API: https://esbuild.github.io/api/#watch
  compilation = await instance({
    ...config,
    minify: true,
  });

  yield;

  const managerFiles = cp(CORE_DIR_ORIGIN, coreDirTarget, {
    filter: (src) => {
      const { ext } = parse(src);
      if (ext) {
        return ext === '.js';
      }
      return true;
    },
    recursive: true,
  });
  const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, compilation?.outputFiles);

  // Build additional global values
  const globals: Record<string, any> = await buildFrameworkGlobalsFromOptions(options);

  yield;

  const html = await renderHTML(
    template,
    title,
    favicon,
    customHead,
    cssFiles,
    jsFiles,
    features,
    refs,
    logLevel,
    docsOptions,
    tagsOptions,
    options,
    globals
  );

  await Promise.all([writeFile(join(options.outputDir, 'index.html'), html), managerFiles]);

  logger.trace({ message: 'Manager built', time: process.hrtime(startTime) });

  return {
    toJson: () => ({}),
  } as BuilderBuildResult;
};

export const bail: ManagerBuilder['bail'] = async () => {
  if (asyncIterator) {
    try {
      // we tell the builder (that started) to stop ASAP and wait
      await asyncIterator.throw(new Error());
    } catch (e) {
      //
    }
  }
};

export const start: ManagerBuilder['start'] = async (options) => {
  asyncIterator = starter(options);
  let result;

  do {
    result = await asyncIterator.next();
  } while (!result.done);

  return result.value;
};

export const build: ManagerBuilder['build'] = async (options) => {
  asyncIterator = builder(options);
  let result;

  do {
    result = await asyncIterator.next();
  } while (!result.done);

  return result.value;
};

export const corePresets: ManagerBuilder['corePresets'] = [];
export const overridePresets: ManagerBuilder['overridePresets'] = [];
