import '../hooks.ts';

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import type { Channel } from '@storybook/core/internal/channels';
import {
  JsPackageManagerFactory,
  type RemoveAddonOptions,
  getDirectoryFromWorkingDir,
  getPreviewBodyTemplate,
  getPreviewHeadTemplate,
  loadEnvs,
  optionalEnvToBoolean,
  removeAddon as removeAddonBase,
} from '@storybook/core/internal/common';
import { logger } from '@storybook/core/internal/node-logger';
import { telemetry } from '@storybook/core/internal/telemetry';
import {
  type CoreConfig,
  type Options,
  type PresetPropertyFn,
} from '@storybook/core/internal/types';

import { storyIndexGeneratorPromise } from '@storybook/core/internal/deep/services/preset';

export {
  experimental_devServer,
  storyIndexGenerator,
  csfIndexer,
} from '@storybook/core/internal/deep/services/preset';

import * as pathe from 'pathe';
import { isAbsolute, join } from 'pathe';
import { dedent } from '@storybook/core/internal/deep/utils/node-libs';

import { resolvePackageDir } from '@storybook/core/internal/deep/utils/module';
import { initAIAnalyticsChannel } from '../server-channel/ai-setup-channel.ts';
import { initGhostStoriesChannel } from '../server-channel/ghost-stories-channel.ts';
import { initOpenInEditorChannel } from '../server-channel/open-in-editor-channel.ts';
import { initTelemetryChannel } from '../server-channel/telemetry-channel.ts';
import { initializeChecklist } from '@storybook/core/internal/deep/services/checklist';
import {
  defaultFavicon,
  defaultStaticDirs,
} from '@storybook/core/internal/deep/common/utils/constants';
import { initializeSaveStory } from '@storybook/core/internal/deep/services/save-story/save-story';
import { parseStaticDir } from '@storybook/core/internal/deep/common/utils/server-statics';
import { type OptionsWithRequiredCache, initializeWhatsNew } from '../utils/whats-new.ts';
import { getWsToken } from './wsToken.ts';

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
    logger.debug(dedent`
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

  const presetConfig: Record<string, unknown> = {
    targets: {
      // This is the same browser supports that we use to bundle our manager and preview code.
      chrome: 100,
      safari: 15,
      firefox: 91,
    },
  };

  const shouldRemoveBugfixes =
    options?.features &&
    'babelRemoveBugfixes' in options.features &&
    options.features.babelRemoveBugfixes;
  if (!shouldRemoveBugfixes) {
    presetConfig.bugfixes = true;
  }

  return {
    ...babelDefault,
    // This override makes sure that we will never transpile babel further down then the browsers that storybook supports.
    // This is needed to support the mount property of the context described here:
    // https://storybook.js.org/docs/writing-tests/interaction-testing#run-code-before-each-story-in-a-file
    overrides: [
      ...(babelDefault?.overrides ?? []),
      {
        include: /\.(story|stories)\.[cm]?[jt]sx?$/,
        presets: [['@babel/preset-env', presetConfig]],
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
  removeAddon = async (id: string, opts: RemoveAddonOptions) => {
    await telemetry('remove', { addon: id, source: 'api' });
    return removeAddonBase(id, { ...opts, packageManager });
  };
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
  channelOptions: {
    ...(existing?.channelOptions ?? {}),
    ...(options.configType === 'DEVELOPMENT' ? { wsToken: getWsToken() } : {}),
  },
  disableTelemetry:
    options.disableTelemetry || optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY),
  enableCrashReports:
    options.enableCrashReports || optionalEnvToBoolean(process.env.STORYBOOK_ENABLE_CRASH_REPORTS),
});

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
  initAIAnalyticsChannel(channel, options, () => storyIndexGeneratorPromise);
  initializeChecklist(channel, () => storyIndexGeneratorPromise, options.configDir);
  initializeWhatsNew(channel, options);
  initializeSaveStory(channel, options);
  initGhostStoriesChannel(channel, options);
  initOpenInEditorChannel(channel);
  initTelemetryChannel(channel);

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
    pathe.join(resolvePackageDir('storybook'), 'dist/storybook/server/presets/common-manager.js'),
    ...(existing || []),
  ];
};
