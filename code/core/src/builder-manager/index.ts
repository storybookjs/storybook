import { cp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';

import { stringifyProcessEnvs } from 'storybook/internal/common';
import { globalsModuleInfoMap } from 'storybook/internal/manager/globals-module-info';
import { logger } from 'storybook/internal/node-logger';

import { globalExternals } from '@fal-works/esbuild-plugin-global-externals';
import { pnpPlugin } from '@yarnpkg/esbuild-plugin-pnp';
import sirv from 'sirv';

import { BROWSER_TARGETS, SUPPORTED_FEATURES } from '../shared/constants/environments-support';
import type {
  BuilderBuildResult,
  BuilderFunction,
  BuilderStartResult,
  Compilation,
  ManagerBuilder,
  StarterFunction,
} from './types';
import { getData } from './utils/data';
import { readOrderedFiles } from './utils/files';
import { buildFrameworkGlobalsFromOptions } from './utils/framework';
import { wrapManagerEntries } from './utils/managerEntries';
import { safeResolve } from './utils/safeResolve';
import { getTemplatePath, renderHTML } from './utils/template';

export { BROWSER_TARGETS, NODE_TARGET } from '../shared/constants/environments-support';

const isRootPath = /^\/($|\?)/;
let compilation: Compilation;
let asyncIterator: ReturnType<StarterFunction> | ReturnType<BuilderFunction>;

export const getConfig: ManagerBuilder['getConfig'] = async (options) => {
  const [addonsEntryPoints, customManagerEntryPoint, tsconfigPath, envs] = await Promise.all([
    options.presets.apply('managerEntries', []),
    safeResolve(join(options.configDir, 'manager')),
    getTemplatePath('addon.tsconfig.json'),
    options.presets.apply<Record<string, string>>('env'),
  ]);

  const entryPoints = customManagerEntryPoint
    ? [...addonsEntryPoints, customManagerEntryPoint]
    : addonsEntryPoints;

  return {
    entryPoints: await wrapManagerEntries(entryPoints, options.cacheKey),
    outdir: join(options.outputDir || './', 'sb-addons'),
    format: 'iife',
    write: false,
    ignoreAnnotations: true,
    resolveExtensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
    outExtension: { '.js': '.js' },
    loader: {
      '.js': 'jsx',
      // media
      '.png': 'dataurl',
      '.gif': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.svg': 'dataurl',
      '.webp': 'dataurl',
      '.webm': 'dataurl',
      '.mp3': 'dataurl',
      // modern fonts
      '.woff2': 'dataurl',
      // legacy font formats
      '.woff': 'dataurl',
      '.eot': 'dataurl',
      '.ttf': 'dataurl',
    },
    target: BROWSER_TARGETS,
    supported: SUPPORTED_FEATURES,
    platform: 'browser',
    bundle: true,
    minify: false,
    minifyWhitespace: false,
    minifyIdentifiers: false,
    minifySyntax: true,
    metafile: false, // turn this on to assist with debugging the bundling of managerEntries

    // treeShaking: true,

    sourcemap: false,
    conditions: ['browser', 'module', 'default'],

    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    jsx: 'transform',
    jsxImportSource: 'react',

    tsconfig: tsconfigPath,

    legalComments: 'external',
    plugins: [globalExternals(globalsModuleInfoMap), pnpPlugin()],

    banner: {
      js: 'try{',
    },
    footer: {
      js: '}catch(e){ console.error("[Storybook] One of your manager-entries failed: " + import.meta.url, e); }',
    },

    define: {
      'process.env': JSON.stringify(envs),
      ...stringifyProcessEnvs(envs),
      global: 'window',
      module: '{}',
    },
  };
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
    logger.info('=> Starting manager..');
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

  const coreDirOrigin = join(
    dirname(require.resolve('storybook/internal/package.json')),
    'dist',
    'manager'
  );

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
    sirv(coreDirOrigin, {
      maxAge: 300000,
      dev: true,
      immutable: true,
    })
  );

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
  logger.info('=> Building manager..');
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
  const coreDirOrigin = join(
    dirname(require.resolve('storybook/internal/package.json')),
    'dist',
    'manager'
  );
  const coreDirTarget = join(options.outputDir, `sb-manager`);

  // TODO: this doesn't watch, we should change this to use the esbuild watch API: https://esbuild.github.io/api/#watch
  compilation = await instance({
    ...config,
    minify: true,
  });

  yield;

  const managerFiles = cp(coreDirOrigin, coreDirTarget, {
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

  logger.trace({ message: '=> Manager built', time: process.hrtime(startTime) });

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
