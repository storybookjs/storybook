import { cp, readFile, rm, writeFile } from 'node:fs/promises';

import { stringifyProcessEnvs } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { resolveModulePath } from 'exsolve';
import { join, parse } from 'pathe';
import type { OutputOptions, Plugin } from 'rolldown';
import sirv from 'sirv';

import { globalsModuleInfoMap } from '../manager/globals/globals-module-info';
import { BROWSER_TARGETS } from '../shared/constants/environments-support';
import { resolvePackageDir } from '../shared/utils/module';
import type {
  BuilderBuildResult,
  BuilderFunction,
  BuilderStartResult,
  Compilation,
  ManagerBuilder,
  ManagerBuilderConfig,
  StarterFunction,
} from './types';
import { getData } from './utils/data';
import { readOrderedFiles } from './utils/files';
import { buildFrameworkGlobalsFromOptions } from './utils/framework';
import { wrapManagerEntries } from './utils/managerEntries';
import { getTemplatePath, renderHTML } from './utils/template';

export { BROWSER_TARGETS, NODE_TARGET } from '../shared/constants/environments-support';

const CORE_DIR_ORIGIN = join(resolvePackageDir('storybook'), 'dist/manager');

const isRootPath = /^\/($|\?)/;
let compilation: Compilation;
let asyncIterator: ReturnType<StarterFunction> | ReturnType<BuilderFunction>;

const dataurlPlugin = () => ({
  name: 'storybook-dataurl',
  async load(id: string) {
    if (!/\.(png|gif|jpg|jpeg|svg|webp|webm|mp3|woff2|woff|eot|ttf)$/.test(id)) {
      return null;
    }
    const ext = parse(id).ext.replace('.', '').toLowerCase();
    const mime = getMimeType(ext);
    const contents = await readFile(id);
    return `export default "data:${mime};base64,${contents.toString('base64')}";`;
  },
});

const getMimeType = (ext: string) => {
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'webp':
      return 'image/webp';
    case 'webm':
      return 'video/webm';
    case 'mp3':
      return 'audio/mpeg';
    case 'woff2':
      return 'font/woff2';
    case 'woff':
      return 'font/woff';
    case 'eot':
      return 'application/vnd.ms-fontobject';
    case 'ttf':
      return 'font/ttf';
    default:
      return 'application/octet-stream';
  }
};

export const getConfig: ManagerBuilder['getConfig'] = async (options) => {
  const [managerEntriesFromPresets, envs] = await Promise.all([
    options.presets.apply('managerEntries', []),
    options.presets.apply<Record<string, string>>('env'),
  ]);
  const tsconfigPath = getTemplatePath('addon.tsconfig.json');
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

  // Plugin that virtualizes external global modules so they read from globalThis
  // instead of leaving bare import specifiers that the browser can't resolve.
  const globalsVirtualPlugin = (): Plugin => ({
    name: 'globals-virtual-externals',
    resolveId(id: string) {
      if (id in globalsModuleInfoMap) {
        return `\0virtual:${id}`;
      }
      return null;
    },
    load(id: string) {
      const PREFIX = '\0virtual:';
      if (id.startsWith(PREFIX)) {
        const moduleId = id.slice(PREFIX.length);
        const info = globalsModuleInfoMap[moduleId as keyof typeof globalsModuleInfoMap];
        if (info) {
          const namedExports: string[] = (info.namedExports as string[]) || [];
          const varName = info.varName;
          const lines = [`const _module = globalThis.${varName};`, `export default _module;`];
          for (const name of namedExports) {
            lines.push(`export const ${name} = _module.${name};`);
          }
          return lines.join('\n');
        }
      }
      return null;
    },
  });

  return {
    outdir: join(options.outputDir || './', 'sb-addons'),
    inputOptions: {
      input: await wrapManagerEntries(entryPoints, options.cacheKey),
      platform: 'browser',
      resolve: {
        extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx'],
        conditionNames: ['browser', 'module', 'default'],
      },
      transform: {
        target: BROWSER_TARGETS,
        jsx: {
          runtime: 'classic',
          pragma: 'React.createElement',
          pragmaFrag: 'React.Fragment',
        },
        define: {
          'process.env': JSON.stringify(envs),
          ...stringifyProcessEnvs(envs),
          global: 'window',
          module: '{}',
        },
      },
      tsconfig: tsconfigPath,
      treeshake: {
        annotations: false,
      },
      plugins: [dataurlPlugin(), globalsVirtualPlugin()],
    },
    outputOptions: {
      format: 'esm',
      sourcemap: false,
      minify: false,
      entryFileNames: '[name].js',
      chunkFileNames: 'chunks/[name]-[hash].js',
      codeSplitting: true,
      comments: {
        legal: false,
      },
    },
  };
};

export const executor = {
  get: async () => {
    const { rolldown } = await import('rolldown');
    return async (config: ManagerBuilderConfig, overrides: Partial<OutputOptions> = {}) => {
      const { inputOptions, outputOptions } = config;
      const mergedOutputOptions = { ...outputOptions, ...overrides };

      // Build all entries together to enable code splitting and shared chunks
      const bundle = await rolldown(inputOptions);
      try {
        const result = await bundle.generate(mergedOutputOptions);
        return result;
      } finally {
        await bundle.close();
      }
    };
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

  compilation = await instance(config);

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

  const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, compilation?.output);

  const metafile = (compilation as { metafile?: unknown }).metafile;
  if (metafile && options.outputDir) {
    await writeFile(join(options.outputDir, 'metafile.json'), JSON.stringify(metafile, null, 2));
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
  compilation = await instance(config, { minify: true });

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
  const { cssFiles, jsFiles } = await readOrderedFiles(addonsDir, compilation?.output);

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
