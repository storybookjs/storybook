import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Channel } from 'storybook/internal/channels';
import { optionalEnvToBoolean } from 'storybook/internal/common';
import {
  JsPackageManagerFactory,
  type RemoveAddonOptions,
  findConfigFile,
  getDirectoryFromWorkingDir,
  getPreviewBodyTemplate,
  getPreviewHeadTemplate,
  loadEnvs,
  removeAddon as removeAddonBase,
} from 'storybook/internal/common';
import { readCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type {
  CoreConfig,
  Indexer,
  Options,
  PresetProperty,
  PresetPropertyFn,
} from 'storybook/internal/types';

import { isAbsolute, join } from 'pathe';
import * as pathe from 'pathe';
import { dedent } from 'ts-dedent';

import { resolvePackageDir } from '../../shared/utils/module';
import { initCreateNewStoryChannel } from '../server-channel/create-new-story-channel';
import { initFileSearchChannel } from '../server-channel/file-search-channel';
import { initOnboarding } from '../server-channel/onboarding';
import { initOpenInEditorChannel } from '../server-channel/open-in-editor-channel';
import { initPreviewInitializedChannel } from '../server-channel/preview-initialized-channel';
import { initializeChecklist } from '../utils/checklist';
import { defaultFavicon, defaultStaticDirs } from '../utils/constants';
import { initializeSaveStory } from '../utils/save-story/save-story';
import { parseStaticDir } from '../utils/server-statics';
import { type OptionsWithRequiredCache, initializeWhatsNew } from '../utils/whats-new';

const interpolate = (string: string, data: Record<string, string> = {}) =>
  Object.entries(data).reduce((acc, [k, v]) => acc.replace(new RegExp(`%${k}%`, 'g'), v), string);

export const staticDirs: PresetPropertyFn<'staticDirs'> = async (values = []) => [
  ...defaultStaticDirs,
  ...values,
];

export const favicon = async (
  value: string | undefined,
  options: Pick<Options, 'presets' | 'configDir'>
) => {
  if (value) {
    return value;
  }

  const staticDirsValue = await options.presets.apply('staticDirs');

  const statics = staticDirsValue
    ? staticDirsValue.map((dir) => (typeof dir === 'string' ? dir : `${dir.from}:${dir.to}`))
    : [];

  const faviconPaths = statics
    .map((dir) => {
      const results = [];
      const normalizedDir =
        staticDirsValue && !isAbsolute(dir)
          ? getDirectoryFromWorkingDir({
              configDir: options.configDir,
              workingDir: process.cwd(),
              directory: dir,
            })
          : dir;

      const { staticPath, targetEndpoint } = parseStaticDir(normalizedDir);

      // Direct favicon references (e.g. `staticDirs: ['favicon.svg']`)
      if (['/favicon.svg', '/favicon.ico'].includes(targetEndpoint)) {
        results.push(staticPath);
      }
      // Favicon files in a static directory (e.g. `staticDirs: ['static']`)
      if (targetEndpoint === '/') {
        results.push(join(staticPath, 'favicon.svg'));
        results.push(join(staticPath, 'favicon.ico'));
      }

      return results.filter((path) => existsSync(path));
    })
    .reduce((l1, l2) => l1.concat(l2), []);

  if (faviconPaths.length > 1) {
    logger.warn(dedent`
      Looks like multiple favicons were detected. Using the first one.

      ${faviconPaths.join(', ')}
    `);
  }

  return faviconPaths[0] || defaultFavicon;
};

export const babel = async (_: unknown, options: Options) => {
  const { presets } = options;
  const babelDefault = ((await presets.apply('babelDefault', {}, options)) ?? {}) as Record<
    string,
    any
  >;
  return {
    ...babelDefault,
    // This override makes sure that we will never transpile babel further down then the browsers that storybook supports.
    // This is needed to support the mount property of the context described here:
    // https://storybook.js.org/docs/writing-tests/interaction-testing#run-code-before-each-test
    overrides: [
      ...(babelDefault?.overrides ?? []),
      {
        include: /\.(story|stories)\.[cm]?[jt]sx?$/,
        presets: [
          [
            '@babel/preset-env',
            {
              bugfixes: true,
              targets: {
                // This is the same browser supports that we use to bundle our manager and preview code.
                chrome: 100,
                safari: 15,
                firefox: 91,
              },
            },
          ],
        ],
      },
    ],
  };
};

export const title = (previous: string, options: Options) =>
  previous || options.packageJson?.name || false;

export const logLevel = (previous: any, options: Options) => previous || options.loglevel || 'info';

export const previewHead = async (base: any, { configDir, presets }: Options) => {
  const interpolations = await presets.apply<Record<string, string>>('env');
  return getPreviewHeadTemplate(configDir, interpolations);
};

export const env = async () => {
  const { raw } = await loadEnvs({ production: true });
  return raw;
};

export const previewBody = async (base: any, { configDir, presets }: Options) => {
  const interpolations = await presets.apply<Record<string, string>>('env');
  return getPreviewBodyTemplate(configDir, interpolations);
};

export const typescript = () => ({
  check: false,
  // 'react-docgen' faster than `react-docgen-typescript` but produces lower quality results
  reactDocgen: 'react-docgen',
  reactDocgenTypescriptOptions: {
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    propFilter: (prop: any) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    // NOTE: this default cannot be changed
    savePropValueAsString: true,
  },
});

/** This API is used by third-parties to access certain APIs in a Node environment */
export const experimental_serverAPI = (extension: Record<string, Function>, options: Options) => {
  let removeAddon = removeAddonBase;
  const packageManager = JsPackageManagerFactory.getPackageManager({
    configDir: options.configDir,
  });
  if (!options.disableTelemetry) {
    removeAddon = async (id: string, opts: RemoveAddonOptions) => {
      await telemetry('remove', { addon: id, source: 'api' });
      return removeAddonBase(id, { ...opts, packageManager });
    };
  }
  return { ...extension, removeAddon };
};

/**
 * If for some reason this config is not applied, the reason is that likely there is an addon that
 * does `export core = () => ({ someConfig })`, instead of `export core = (existing) => ({
 * ...existing, someConfig })`, just overwriting everything and not merging with the existing
 * values.
 */
export const core = async (existing: CoreConfig, options: Options): Promise<CoreConfig> => ({
  ...existing,
  disableTelemetry: options.disableTelemetry === true,
  enableCrashReports:
    options.enableCrashReports || optionalEnvToBoolean(process.env.STORYBOOK_ENABLE_CRASH_REPORTS),
});

export const features: PresetProperty<'features'> = async (existing) => ({
  ...existing,
  argTypeTargetsV7: true,
  legacyDecoratorFileOrder: false,
  disallowImplicitActionsInRenderV8: true,
  viewport: true,
  highlight: true,
  controls: true,
  interactions: true,
  actions: true,
  backgrounds: true,
  outline: true,
  measure: true,
});

export const csfIndexer: Indexer = {
  test: /(stories|story)\.(m?js|ts)x?$/,
  createIndex: async (fileName, options) => (await readCsf(fileName, options)).parse().indexInputs,
};

export const experimental_indexers: PresetProperty<'experimental_indexers'> = (existingIndexers) =>
  [csfIndexer].concat(existingIndexers || []);

export const frameworkOptions = async (
  _: never,
  options: Options
): Promise<Record<string, any> | null> => {
  const config = await options.presets.apply('framework');

  if (typeof config === 'string') {
    return {};
  }

  if (typeof config === 'undefined') {
    return null;
  }

  return config.options;
};

export const managerHead = async (_: any, options: Options) => {
  const location = join(options.configDir, 'manager-head.html');
  if (existsSync(location)) {
    const contents = readFile(location, { encoding: 'utf8' });
    const interpolations = options.presets.apply<Record<string, string>>('env');

    return interpolate(await contents, await interpolations);
  }

  return '';
};

export const experimental_serverChannel = async (
  channel: Channel,
  options: OptionsWithRequiredCache
) => {
  const coreOptions = await options.presets.apply('core');

  initializeChecklist();
  initializeWhatsNew(channel, options, coreOptions);
  initializeSaveStory(channel, options, coreOptions);

  initFileSearchChannel(channel, options, coreOptions);
  initCreateNewStoryChannel(channel, options, coreOptions);
  initOpenInEditorChannel(channel, options, coreOptions);
  initPreviewInitializedChannel(channel, options, coreOptions);

  initOnboarding(channel, options, coreOptions);

  return channel;
};

/**
 * Try to resolve react and react-dom from the root node_modules of the project addon-docs uses this
 * to alias react and react-dom to the project's version when possible If the user doesn't have an
 * explicit dependency on react this will return the existing values Which will be the versions
 * shipped with addon-docs
 */
export const resolvedReact = async (existing: any) => {
  try {
    return {
      ...existing,
      react: resolvePackageDir('react'),
      reactDom: resolvePackageDir('react-dom'),
    };
  } catch (e) {
    return existing;
  }
};

export const managerEntries = async (existing: any) => {
  return [
    pathe.join(resolvePackageDir('storybook'), 'dist/core-server/presets/common-manager.js'),
    ...(existing || []),
  ];
};

export const viteFinal = async (
  existing: import('vite').UserConfig,
  options: Options
): Promise<import('vite').UserConfig> => {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  // If there's no preview file, there's nothing to mock.
  if (!previewConfigPath) {
    return existing;
  }

  const { viteInjectMockerRuntime } = await import('./vitePlugins/vite-inject-mocker/plugin');
  const { viteMockPlugin } = await import('./vitePlugins/vite-mock/plugin');
  const coreOptions = await options.presets.apply('core');

  return {
    ...existing,
    plugins: [
      ...(existing.plugins ?? []),
      ...(previewConfigPath
        ? [
            viteInjectMockerRuntime({ previewConfigPath }),
            viteMockPlugin({ previewConfigPath, coreOptions, configDir: options.configDir }),
          ]
        : []),
    ],
  };
};

export const webpackFinal = async (
  config: import('webpack').Configuration,
  options: Options
): Promise<import('webpack').Configuration> => {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  // If there's no preview file, there's nothing to mock.
  if (!previewConfigPath) {
    return config;
  }

  const { WebpackMockPlugin } = await import('./webpack/plugins/webpack-mock-plugin');
  const { WebpackInjectMockerRuntimePlugin } = await import(
    './webpack/plugins/webpack-inject-mocker-runtime-plugin'
  );

  config.plugins = config.plugins || [];

  // 1. Add the loader to normalize sb.mock(import(...)) calls.
  config.module!.rules!.push({
    test: /preview\.(t|j)sx?$/,
    use: [
      {
        loader: fileURLToPath(
          import.meta.resolve('storybook/webpack/loaders/storybook-mock-transform-loader')
        ),
      },
    ],
  });

  // 2. Add the plugin to handle module replacement based on sb.mock() calls.
  // This plugin scans the preview file and sets up rules to swap modules.
  config.plugins.push(new WebpackMockPlugin({ previewConfigPath }));

  // 3. Add the plugin to inject the mocker runtime script into the HTML.
  // This ensures the `sb` object is available before any other code runs.
  config.plugins.push(new WebpackInjectMockerRuntimePlugin());

  return config;
};
