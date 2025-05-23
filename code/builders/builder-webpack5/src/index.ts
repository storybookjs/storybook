import { cp } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';

import { PREVIEW_BUILDER_PROGRESS } from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import {
  WebpackCompilationError,
  WebpackInvocationError,
  WebpackMissingStatsError,
} from 'storybook/internal/server-errors';
import type { Builder, Options } from 'storybook/internal/types';

import { checkWebpackVersion } from '@storybook/core-webpack';

import prettyTime from 'pretty-hrtime';
import sirv from 'sirv';
import type { Configuration, Stats, StatsOptions } from 'webpack';
import webpackDep, { DefinePlugin, IgnorePlugin, ProgressPlugin } from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

export * from './types';
export * from './preview/virtual-module-mapping';

export const WebpackDefinePlugin = DefinePlugin;
export const WebpackIgnorePlugin = IgnorePlugin;

export const printDuration = (startTime: [number, number]) =>
  prettyTime(process.hrtime(startTime))
    .replace(' ms', ' milliseconds')
    .replace(' s', ' seconds')
    .replace(' min', ' minutes');

const corePath = dirname(require.resolve('storybook/internal/package.json'));

let compilation: ReturnType<typeof webpackDevMiddleware> | undefined;
let reject: (reason?: any) => void;

type WebpackBuilder = Builder<Configuration, Stats>;
type Unpromise<T extends Promise<any>> = T extends Promise<infer U> ? U : never;

type BuilderStartOptions = Parameters<WebpackBuilder['start']>['0'];
type BuilderStartResult = Unpromise<ReturnType<WebpackBuilder['start']>>;
type StarterFunction = (
  options: BuilderStartOptions
) => AsyncGenerator<unknown, BuilderStartResult, void>;

type BuilderBuildOptions = Parameters<WebpackBuilder['build']>['0'];
type BuilderBuildResult = Unpromise<ReturnType<WebpackBuilder['build']>>;
type BuilderFunction = (
  options: BuilderBuildOptions
) => AsyncGenerator<Stats | undefined, BuilderBuildResult, void>;

export const executor = {
  get: async (options: Options) => {
    const version = ((await options.presets.apply('webpackVersion')) || '5') as string;
    const webpackInstance =
      (await options.presets.apply<{ default: typeof webpackDep }>('webpackInstance'))?.default ||
      webpackDep;
    checkWebpackVersion({ version }, '5', 'builder-webpack5');
    return webpackInstance;
  },
};

export const getConfig: WebpackBuilder['getConfig'] = async (options) => {
  const { presets } = options;
  const typescriptOptions = await presets.apply('typescript', {}, options);
  const frameworkOptions = await presets.apply<any>('frameworkOptions');

  return presets.apply(
    'webpack',
    {},
    {
      ...options,
      typescriptOptions,
      frameworkOptions,
    }
  ) as any;
};

let asyncIterator: ReturnType<StarterFunction> | ReturnType<BuilderFunction>;

export const bail: WebpackBuilder['bail'] = async () => {
  if (asyncIterator) {
    try {
      // we tell the builder (that started) to stop ASAP and wait
      await asyncIterator.throw(new Error());
    } catch (e) {
      //
    }
  }

  if (reject) {
    reject();
  }
  // we wait for the compiler to finish it's work, so it's command-line output doesn't interfere
  return new Promise((res, rej) => {
    if (process && compilation) {
      try {
        compilation.close(() => res());
        logger.warn('Force closed preview build');
      } catch (err) {
        logger.warn('Unable to close preview build!');
        res();
      }
    } else {
      res();
    }
  });
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
  channel,
}) {
  const webpackInstance = await executor.get(options);
  yield;

  const config = await getConfig(options);

  if (config.stats === 'none' || config.stats === 'summary') {
    throw new WebpackMissingStatsError();
  }
  yield;

  const compiler = webpackInstance(config);

  if (!compiler) {
    throw new WebpackInvocationError({
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      error: new Error(`Missing Webpack compiler at runtime!`),
    });
  }

  yield;
  const modulesCount = await options.cache?.get('modulesCount', 1000);
  let totalModules: number;
  let value = 0;

  new ProgressPlugin({
    handler: (newValue, message, arg3) => {
      value = Math.max(newValue, value); // never go backwards
      const progress = { value, message: message.charAt(0).toUpperCase() + message.slice(1) };
      if (message === 'building') {
        // arg3 undefined in webpack5
        const counts = (arg3 && arg3.match(/entries (\d+)\/(\d+)/)) || [];
        const complete = parseInt(counts[1], 10);
        const total = parseInt(counts[2], 10);
        if (!Number.isNaN(complete) && !Number.isNaN(total)) {
          (progress as any).modules = { complete, total };
          totalModules = total;
        }
      }

      if (value === 1) {
        if (options.cache) {
          options.cache.set('modulesCount', totalModules);
        }

        if (!progress.message) {
          progress.message = `Completed in ${printDuration(startTime)}.`;
        }
      }

      channel.emit(PREVIEW_BUILDER_PROGRESS, progress);
    },
    modulesCount,
  }).apply(compiler);

  const middlewareOptions: Parameters<typeof webpackDevMiddleware>[1] = {
    publicPath: config.output?.publicPath as string,
    writeToDisk: true,
    stats: 'errors-only',
  };

  compilation = webpackDevMiddleware(compiler, middlewareOptions);

  const previewResolvedDir = join(corePath, 'dist/preview');
  router.use(
    '/sb-preview',
    sirv(previewResolvedDir, {
      maxAge: 300000,
      dev: true,
      immutable: true,
    })
  );
  router.use(compilation);
  router.use(webpackHotMiddleware(compiler, { log: false }));

  const stats = await new Promise<Stats>((res, rej) => {
    compilation?.waitUntilValid(res as any);
    reject = rej;
  });
  yield;

  if (!stats) {
    throw new WebpackMissingStatsError();
  }

  const { warnings, errors } = getWebpackStats({ config, stats });

  if (warnings.length > 0) {
    warnings?.forEach((e) => logger.warn(e.message));
  }

  if (errors.length > 0) {
    throw new WebpackCompilationError({ errors });
  }

  return {
    bail,
    stats,
    totalTime: process.hrtime(startTime),
  };
};

function getWebpackStats({ config, stats }: { config: Configuration; stats: Stats }) {
  const statsOptions =
    typeof config.stats === 'string'
      ? config.stats
      : {
          ...(config.stats as StatsOptions),
          warnings: true,
          errors: true,
        };
  const { warnings = [], errors = [] } = stats?.toJson(statsOptions) || {};
  return {
    warnings,
    errors,
  };
}

/**
 * This function is a generator so that we can abort it mid process in case of failure coming from
 * other processes e.g. manager builder
 *
 * I am sorry for making you read about generators today :')
 */
const builder: BuilderFunction = async function* builderGeneratorFn({ startTime, options }) {
  const webpackInstance = await executor.get(options);
  yield;
  const config = await getConfig(options);

  if (config.stats === 'none' || config.stats === 'summary') {
    throw new WebpackMissingStatsError();
  }
  yield;

  const compiler = webpackInstance(config);

  if (!compiler) {
    throw new WebpackInvocationError({
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      error: new Error(`Missing Webpack compiler at runtime!`),
    });
  }

  const webpackCompilation = new Promise<Stats>((succeed, fail) => {
    compiler.run((error, stats) => {
      if (error) {
        compiler.close(() => fail(new WebpackInvocationError({ error })));
        return;
      }

      if (!stats) {
        throw new WebpackMissingStatsError();
      }

      const { warnings, errors } = getWebpackStats({ config, stats });

      if (warnings.length > 0) {
        warnings?.forEach((e) => logger.warn(e.message));
      }

      if (errors.length > 0) {
        errors.forEach((e) => logger.error(e.message));
        compiler.close(() => fail(new WebpackCompilationError({ errors })));
        return;
      }

      compiler.close((closeErr) => {
        if (closeErr) {
          return fail(new WebpackInvocationError({ error: closeErr }));
        }

        return succeed(stats as Stats);
      });
    });
  });

  const previewResolvedDir = join(corePath, 'dist/preview');
  const previewDirTarget = join(options.outputDir || '', `sb-preview`);
  const previewFiles = cp(previewResolvedDir, previewDirTarget, {
    filter: (src) => {
      const { ext } = parse(src);
      if (ext) {
        return ext === '.js';
      }
      return true;
    },
    recursive: true,
  });

  const [webpackCompilationOutput] = await Promise.all([webpackCompilation, previewFiles]);

  return webpackCompilationOutput;
};

export const start = async (options: BuilderStartOptions) => {
  asyncIterator = starter(options);
  let result;

  do {
    result = await asyncIterator.next();
  } while (!result.done);

  return result.value;
};

export const build = async (options: BuilderStartOptions) => {
  asyncIterator = builder(options);
  let result;

  do {
    result = await asyncIterator.next();
  } while (!result.done);

  return result.value;
};

export const corePresets = [join(__dirname, 'presets/preview-preset.js')];
export const overridePresets = [join(__dirname, './presets/custom-webpack-preset.js')];
