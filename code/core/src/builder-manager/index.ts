import { cp, rm, writeFile } from 'node:fs/promises';

import { stringifyProcessEnvs } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { resolveModulePath } from 'exsolve';
import { join, parse } from 'pathe';
import sirv from 'sirv';

import { globalsModuleInfoMap } from '../manager/globals/globals-module-info.ts';
import { BROWSER_TARGETS } from '../shared/constants/environments-support.ts';
import { resolvePackageDir } from '../shared/utils/module.ts';
import type {
  BuilderBuildResult,
  BuilderFunction,
  BuilderStartResult,
  ManagerBuilder,
  StarterFunction,
} from './types.ts';
import { bundleManagerEntries } from './utils/bundle.ts';
import { getData } from './utils/data.ts';
import { readOrderedFiles } from './utils/files.ts';
import { buildFrameworkGlobalsFromOptions } from './utils/framework.ts';
import { globalExternals } from './utils/global-externals.ts';
import { wrapManagerEntries } from './utils/managerEntries.ts';
import { renderHTML } from './utils/template.ts';

export { BROWSER_TARGETS, NODE_TARGET } from '../shared/constants/environments-support.ts';

const CORE_DIR_ORIGIN = join(resolvePackageDir('storybook'), 'dist/manager');

const DATA_URL_EXTENSIONS = [
  // media
  '.png',
  '.gif',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.webm',
  '.mp3',
  // modern fonts
  '.woff2',
  // legacy font formats
  '.woff',
  '.eot',
  '.ttf',
];

const isRootPath = /^\/($|\?)/;
let asyncIterator: ReturnType<StarterFunction> | ReturnType<BuilderFunction>;

export const getConfig: ManagerBuilder['getConfig'] = async (options) => {
  const [managerEntriesFromPresets, envs] = await Promise.all([
    options.presets.apply('managerEntries', []),
    options.presets.apply<Record<string, string>>('env'),
  ]);
  let configDirManagerEntry;
  try {
    configDirManagerEntry = resolveModulePath('./manager', {
      from: options.configDir,
      extensions: ['.js', '.mjs', '.jsx', '.ts', '.mts', '.tsx'],
    });
  } catch (e) {
    // no manager entry found in config directory, that's fine
  }

  const entryPoints = configDirManagerEntry
    ? [...managerEntriesFromPresets, configDirManagerEntry]
    : managerEntriesFromPresets;

  return {
    entryPoints: await wrapManagerEntries(entryPoints, options.cacheKey),
    outdir: join(options.outputDir || './', 'sb-addons'),
    platform: 'browser',
    // The tsconfig of a project or of a package must not change how a manager entry compiles.
    tsconfig: false,
    resolve: {
      extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
      conditionNames: ['browser', 'module', 'default'],
    },
    moduleTypes: {
      '.js': 'jsx',
      ...Object.fromEntries(DATA_URL_EXTENSIONS.map((extension) => [extension, 'dataurl'])),
    },
    // A manager entry is imported for what it registers, so neither a pure annotation nor a
    // `sideEffects` field of a package may remove a module.
    treeshake: { annotations: false, moduleSideEffects: [{ test: /.*/, sideEffects: true }] },
    transform: {
      target: BROWSER_TARGETS,
      jsx: { runtime: 'classic', pragma: 'React.createElement', pragmaFrag: 'React.Fragment' },
      define: {
        'process.env': JSON.stringify(envs),
        ...stringifyProcessEnvs(envs),
        global: 'window',
      },
    },
    plugins: [globalExternals(globalsModuleInfoMap)],
    output: {
      format: 'iife',
      minify: { compress: true, mangle: false, codegen: { removeWhitespace: false } },
      comments: { legal: true, annotation: true, jsdoc: false },
      // Published addons expect a constant that is read early in an import cycle to be
      // `undefined`: neither an error, nor already the value that Rolldown would inline.
      topLevelVar: true,
    },
    optimization: { inlineConst: false },
  };
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

  const outputFiles = await bundleManagerEntries(config, false);

  yield;

  router.use(
    '/sb-addons',
    sirv(addonsDir, {
      maxAge: 300000,
      dev: true,
      immutable: true,
    })
  );
  router.use(
    '/sb-manager',
    sirv(CORE_DIR_ORIGIN, {
      maxAge: 300000,
      dev: true,
      immutable: true,
    })
  );

  const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, outputFiles);

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

  const outputFiles = await bundleManagerEntries(config, true);

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
  const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, outputFiles);

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
