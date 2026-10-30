import './hooks.ts';

import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { logConfig } from '@storybook/core/internal/common';
import { PREVIEW_BUILDER_PROGRESS } from '@storybook/core/internal/core-events';
import type { BuilderAddon, Storybook } from '@storybook/core';
import { logger } from '@storybook/core/internal/node-logger';
import type { PreviewSources } from '@storybook/core/internal/preview-page';
import {
  StorybookPackageRequiredError,
  WebpackCompilationError,
  WebpackInvocationError,
  WebpackMissingStatsError,
} from '@storybook/core/internal/server-errors';

import { loadCustomWebpackConfig } from './load-custom-webpack-config.ts';

import { dirname, join, parse } from 'pathe';
import prettyTime from 'pretty-hrtime';
import sirv from 'sirv';
import type { Compiler, Configuration, Stats, StatsError, StatsOptions } from 'webpack';
import webpackModule from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

import {
  createHeadlessWebpackChangeDetectionAdapter,
  createWebpackChangeDetectionAdapter,
} from './change-detection-adapter/index.ts';
import { WebpackInjectMockerRuntimePlugin } from './plugins/webpack-inject-mocker-runtime-plugin.ts';
import { WebpackMockPlugin } from './plugins/webpack-mock-plugin.ts';
import { createDefaultWebpackConfig } from './preview/base-webpack.config.ts';
import {
  createIframeWebpackConfig,
  MOCKER_RUNTIME_ASSET,
} from './preview/iframe-webpack.config.ts';
import type { BuilderOptions, TypescriptOptions } from './types.ts';

/** Resolved preview compiler configuration and the Webpack instance that compiles it. */
export interface WebpackPreviewConfig {
  config: Configuration;
  webpack: typeof webpackModule;
}

const POSTCSS_ADDON = /@storybook(\/|\\)addon-postcss/;

const { DefinePlugin, IgnorePlugin, ProgressPlugin } = webpackModule;

export const WebpackDefinePlugin = DefinePlugin;
export const WebpackIgnorePlugin = IgnorePlugin;

export const printDuration = (startTime: [number, number]): string =>
  prettyTime(process.hrtime(startTime))
    .replace(' ms', ' milliseconds')
    .replace(' s', ' seconds')
    .replace(' min', ' minutes');

/**
 * Compute the preview config: Storybook's base, `builder:webpack-config:extend`, the default
 * loaders, `builder:webpack:extend`, module mocking, then a custom `webpack.config` in full control.
 */
export async function getWebpackConfig(
  storybook: Storybook,
  preview: PreviewSources,
  input: { outputDir: string; builderOptions: BuilderOptions | void }
): Promise<WebpackPreviewConfig> {
  const { options, configDir } = storybook;
  const configType =
    options.configType ?? (storybook.mode === 'build' ? 'PRODUCTION' : 'DEVELOPMENT');
  const isProd = configType === 'PRODUCTION';
  const [typescriptOptions, frameworkOptions, framework, core, entries, instance, modulesCount] =
    await Promise.all([
      storybook.callHook('core:typescript:extend', {}),
      storybook.callHook('core:framework-options:extend', undefined),
      storybook.callHook('core:framework:extend', undefined),
      storybook.callHook('core:config:extend', undefined),
      storybook.callHook('preview:entries:collect', []),
      storybook.callHook('builder:webpack-instance:extend', webpackModule),
      options.cache?.get('modulesCount', 1000) as Promise<number | undefined> | undefined,
    ]);
  const webpack = typeof instance === 'function' ? instance : instance.default;
  // `framework.options.builder` wins over factory options, then `main.ts` `core.builder.options`.
  const builderOptions: BuilderOptions =
    (typeof framework === 'object' && framework?.options?.builder) ||
    input.builderOptions ||
    (typeof core?.builder === 'object' && core.builder.options) ||
    {};
  const { docs: _docs, ...legacyOptions } = options;
  const ctx = {
    ...legacyOptions,
    configType,
    outputDir: input.outputDir,
    typescriptOptions,
    frameworkOptions,
    webpackInstance: webpack,
  };

  const base = createIframeWebpackConfig(preview, {
    isProd,
    outputDir: input.outputDir,
    entries: [...(isProd ? [] : [getHotClientEntry(options.quiet)]), ...entries],
    builderOptions,
    typescriptOptions: typescriptOptions as Partial<TypescriptOptions>,
    build: options.build,
    quiet: options.quiet,
    modulesCount,
  });
  const extended = await storybook.callHook('builder:webpack-config:extend', base, ctx);
  const withDefaults = core?.disableWebpackDefaults
    ? extended
    : createDefaultWebpackConfig(extended, {
        hasPostcssAddon: storybook.addons.some((addon) => POSTCSS_ADDON.test(addon.name)),
      });
  const final = withMocking(
    await storybook.callHook('builder:webpack:extend', withDefaults, ctx),
    preview.previewConfigPath
  );

  const customConfig = await loadCustomWebpackConfig(configDir);
  if (typeof customConfig === 'function') {
    logger.info('Loading custom Webpack config (full-control mode).');
    return { config: await customConfig({ config: final, mode: configType }), webpack };
  }
  logger.info('Using default Webpack5 setup');
  return { config: final, webpack };
}

/** Create one builder's compiler state: dev server, static build, and change detection. */
export function createWebpackBuilder(
  factoryOptions: BuilderOptions | void
): Pick<BuilderAddon, 'dev' | 'build' | 'changeDetectionAdapter'> {
  let compilation: ReturnType<typeof webpackDevMiddleware> | undefined;
  let activeCompiler: Compiler | undefined;
  let rejectPending: ((reason?: unknown) => void) | undefined;

  async function bail(): Promise<void> {
    rejectPending?.();
    rejectPending = undefined;
    activeCompiler = undefined;
    const current = compilation;
    compilation = undefined;
    if (!current) {
      return;
    }
    await new Promise<void>((resolve) => {
      try {
        current.close(() => resolve());
        logger.warn('Force closed preview build');
      } catch {
        logger.warn('Unable to close preview build!');
        resolve();
      }
    });
  }

  async function resolveConfig(
    storybook: Storybook,
    preview: PreviewSources,
    outputDir: string
  ): Promise<WebpackPreviewConfig> {
    const resolved = await getWebpackConfig(storybook, preview, {
      outputDir,
      builderOptions: factoryOptions,
    });
    if (storybook.options.debugWebpack) {
      logConfig('Preview webpack config', resolved.config);
    }
    if (resolved.config.stats === 'none' || resolved.config.stats === 'summary') {
      throw new WebpackMissingStatsError();
    }
    return resolved;
  }

  return {
    async dev(storybook, { router, startTime, preview }) {
      try {
        const { config, webpack } = await resolveConfig(
          storybook,
          preview,
          storybook.options.outputDir ?? join('.', 'public')
        );
        const compiler = createCompiler(webpack, config);
        activeCompiler = compiler;
        await applyProgress(storybook, compiler, startTime);

        compilation = webpackDevMiddleware(compiler, {
          publicPath: config.output?.publicPath as string,
          writeToDisk: true,
          stats: 'errors-only',
        });
        router.use(
          '/sb-preview',
          sirv(dirname(preview.previewRuntimePath), { maxAge: 300000, dev: true, immutable: true })
        );
        router.use(compilation);
        router.use(webpackHotMiddleware(compiler, { log: false }));

        const stats = await new Promise<Stats>((resolve, reject) => {
          compilation?.waitUntilValid(resolve as (stats: unknown) => void);
          rejectPending = reject;
        });
        rejectPending = undefined;
        if (!stats) {
          throw new WebpackMissingStatsError();
        }
        const { warnings, errors } = getWebpackStats(config, stats);
        warnings.forEach((warning) => logger.warn(warning.message));
        if (errors.length > 0) {
          throw new WebpackCompilationError({ errors });
        }
        return { bail, stats, totalTime: process.hrtime(startTime) };
      } catch (error) {
        await bail().catch(() => undefined);
        throw error;
      }
    },

    async build(storybook, { outDir, preview }) {
      const { config, webpack } = await resolveConfig(storybook, preview, outDir);
      const compiler = createCompiler(webpack, config);

      const webpackCompilation = new Promise<Stats>((succeed, fail) => {
        compiler.run((error, stats) => {
          if (error) {
            compiler.close(() => fail(new WebpackInvocationError({ error })));
            return;
          }
          if (!stats) {
            throw new WebpackMissingStatsError();
          }
          const { warnings, errors } = getWebpackStats(config, stats);
          warnings.forEach((warning) => logger.warn(warning.message));
          if (errors.length > 0) {
            errors.forEach((e) => logger.error(e.message));
            compiler.close(() => fail(new WebpackCompilationError({ errors })));
            return;
          }
          compiler.close((closeError) =>
            closeError ? fail(new WebpackInvocationError({ error: closeError })) : succeed(stats)
          );
        });
      });
      const previewFiles = cp(dirname(preview.previewRuntimePath), join(outDir, 'sb-preview'), {
        filter: (src) => {
          const { ext } = parse(src);
          return ext ? ext === '.js' : true;
        },
        recursive: true,
      });

      const [stats] = await Promise.all([webpackCompilation, previewFiles]);
      return stats;
    },

    changeDetectionAdapter(storybook) {
      if (activeCompiler) {
        return createWebpackChangeDetectionAdapter(activeCompiler);
      }
      return createHeadlessWebpackChangeDetectionAdapter(async () => {
        // The preview runtime ships with `storybook`; load it lazily so the builder runs without it.
        const { getPreviewSources } = await import('storybook/internal/preview-page').catch(
          (error: unknown) => {
            throw new StorybookPackageRequiredError({
              feature: 'Headless Webpack change detection',
              error,
            });
          }
        );
        const preview = await getPreviewSources(storybook, { hmr: 'webpack' });
        const { config } = await getWebpackConfig(storybook, preview, {
          outputDir: storybook.options.outputDir ?? join('.', 'public'),
          builderOptions: factoryOptions,
        });
        return config;
      }, storybook.configDir);
    },
  };
}

// Suppress informational messages for `--quiet`; the client's own `quiet` would also hide warnings.
function getHotClientEntry(quiet: boolean | undefined): string {
  const overlay = JSON.stringify({ errors: true, warnings: false, runtimeErrors: false });
  return `${fileURLToPath(
    import.meta.resolve('webpack-hot-middleware/client.js')
  )}?reload=true&quiet=false&overlay=${overlay}&noInfo=${quiet}`;
}

function withMocking(config: Configuration, previewConfigPath: string | undefined): Configuration {
  if (!previewConfigPath) {
    return config;
  }
  config.plugins = config.plugins || [];
  config.module!.rules!.push({
    test: /preview\.(t|j)sx?$/,
    use: [
      {
        loader: fileURLToPath(
          import.meta.resolve('@storybook/builder-webpack5/loaders/storybook-mock-transform-loader')
        ),
      },
    ],
  });
  config.plugins.push(
    new WebpackMockPlugin({ previewConfigPath }),
    new WebpackInjectMockerRuntimePlugin(MOCKER_RUNTIME_ASSET)
  );
  return config;
}

function createCompiler(webpack: typeof webpackModule, config: Configuration): Compiler {
  const compiler = webpack(config);
  if (!compiler) {
    throw new WebpackInvocationError({
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      error: new Error(`Missing Webpack compiler at runtime!`),
    });
  }
  return compiler;
}

async function applyProgress(
  storybook: Storybook,
  compiler: Compiler,
  startTime: [number, number]
): Promise<void> {
  const { cache } = storybook.options;
  const modulesCount = (await cache?.get('modulesCount', 1000)) as number | undefined;
  let totalModules: number;
  let value = 0;
  new ProgressPlugin({
    handler: (newValue, message, arg3) => {
      value = Math.max(newValue, value); // never go backwards
      const progress: { value: number; message: string; modules?: object } = {
        value,
        message: message.charAt(0).toUpperCase() + message.slice(1),
      };
      if (message === 'building') {
        const counts = (arg3 && arg3.match(/entries (\d+)\/(\d+)/)) || [];
        const complete = parseInt(counts[1], 10);
        const total = parseInt(counts[2], 10);
        if (!Number.isNaN(complete) && !Number.isNaN(total)) {
          progress.modules = { complete, total };
          totalModules = total;
        }
      }
      if (value === 1) {
        cache?.set('modulesCount', totalModules);
        if (!progress.message) {
          progress.message = `Completed in ${printDuration(startTime)}.`;
        }
      }
      storybook.channel.emit(PREVIEW_BUILDER_PROGRESS, progress);
    },
    modulesCount,
  }).apply(compiler);
}

function getWebpackStats(
  config: Configuration,
  stats: Stats
): { warnings: StatsError[]; errors: StatsError[] } {
  const statsOptions =
    typeof config.stats === 'string'
      ? config.stats
      : { ...(config.stats as StatsOptions), warnings: true, errors: true };
  const { warnings = [], errors = [] } = stats?.toJson(statsOptions) || {};
  return { warnings, errors };
}
