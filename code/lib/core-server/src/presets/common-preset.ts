import fs, { pathExists, readFile } from 'fs-extra';
import { deprecate, logger } from '@storybook/node-logger';
import { telemetry } from '@storybook/telemetry';
import {
  findConfigFile,
  getDirectoryFromWorkingDir,
  getPreviewBodyTemplate,
  getPreviewHeadTemplate,
  loadEnvs,
} from '@storybook/core-common';
import type {
  CLIOptions,
  CoreConfig,
  Indexer,
  Options,
  PresetPropertyFn,
  StorybookConfig,
} from '@storybook/types';
import { printConfig, readConfig, readCsf } from '@storybook/csf-tools';
import { join, isAbsolute } from 'path';
import { dedent } from 'ts-dedent';
import fetch from 'node-fetch';
import type { Channel } from '@storybook/channels';
import type { WhatsNewCache, WhatsNewData } from '@storybook/core-events';
import {
  REQUEST_WHATS_NEW_DATA,
  RESULT_WHATS_NEW_DATA,
  TELEMETRY_ERROR,
  SET_WHATS_NEW_CACHE,
  TOGGLE_WHATS_NEW_NOTIFICATIONS,
} from '@storybook/core-events';
import invariant from 'tiny-invariant';
import { parseStaticDir } from '../utils/server-statics';
import { defaultStaticDirs } from '../utils/constants';
import { sendTelemetryError } from '../withTelemetry';

const interpolate = (string: string, data: Record<string, string> = {}) =>
  Object.entries(data).reduce((acc, [k, v]) => acc.replace(new RegExp(`%${k}%`, 'g'), v), string);

const defaultFavicon = require.resolve('@storybook/core-server/public/favicon.svg');

export const staticDirs: PresetPropertyFn<'staticDirs'> = async (values = []) => [
  ...defaultStaticDirs,
  ...values,
];

export const favicon = async (
  value: string | undefined,
  options: Pick<Options, 'presets' | 'configDir' | 'staticDir'>
) => {
  if (value) {
    return value;
  }
  const staticDirsValue = await options.presets.apply('staticDirs');

  const statics = staticDirsValue
    ? staticDirsValue.map((dir) => (typeof dir === 'string' ? dir : `${dir.from}:${dir.to}`))
    : options.staticDir;

  if (statics && statics.length > 0) {
    const lists = await Promise.all(
      statics.map(async (dir) => {
        const results = [];
        const normalizedDir =
          staticDirsValue && !isAbsolute(dir)
            ? getDirectoryFromWorkingDir({
                configDir: options.configDir,
                workingDir: process.cwd(),
                directory: dir,
              })
            : dir;

        const { staticPath, targetEndpoint } = await parseStaticDir(normalizedDir);

        if (targetEndpoint === '/') {
          const url = 'favicon.svg';
          const path = join(staticPath, url);
          if (await pathExists(path)) {
            results.push(path);
          }
        }
        if (targetEndpoint === '/') {
          const url = 'favicon.ico';
          const path = join(staticPath, url);
          if (await pathExists(path)) {
            results.push(path);
          }
        }

        return results;
      })
    );
    const flatlist = lists.reduce((l1, l2) => l1.concat(l2), []);

    if (flatlist.length > 1) {
      logger.warn(dedent`
        Looks like multiple favicons were detected. Using the first one.

        ${flatlist.join(', ')}
        `);
    }

    return flatlist[0] || defaultFavicon;
  }

  return defaultFavicon;
};

export const babel = async (_: unknown, options: Options) => {
  const { presets } = options;

  return presets.apply('babelDefault', {}, options);
};

export const title = (previous: string, options: Options) =>
  previous || options.packageJson.name || false;

export const logLevel = (previous: any, options: Options) => previous || options.loglevel || 'info';

export const previewHead = async (base: any, { configDir, presets }: Options) => {
  const interpolations = await presets.apply<Record<string, string>>('env');
  return getPreviewHeadTemplate(configDir, interpolations);
};

export const env = async () => {
  return loadEnvs({ production: true }).raw;
};

export const previewBody = async (base: any, { configDir, presets }: Options) => {
  const interpolations = await presets.apply<Record<string, string>>('env');
  return getPreviewBodyTemplate(configDir, interpolations);
};

export const typescript = () => ({
  check: false,
  // 'react-docgen' faster but produces lower quality typescript results
  reactDocgen: 'react-docgen-typescript',
  reactDocgenTypescriptOptions: {
    shouldExtractLiteralValuesFromEnum: true,
    shouldRemoveUndefinedFromOptional: true,
    propFilter: (prop: any) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    // NOTE: this default cannot be changed
    savePropValueAsString: true,
  },
});

const optionalEnvToBoolean = (input: string | undefined): boolean | undefined => {
  if (input === undefined) {
    return undefined;
  }
  if (input.toUpperCase() === 'FALSE') {
    return false;
  }
  if (input.toUpperCase() === 'TRUE') {
    return true;
  }
  if (typeof input === 'string') {
    return true;
  }
  return undefined;
};

/**
 * If for some reason this config is not applied, the reason is that
 * likely there is an addon that does `export core = () => ({ someConfig })`,
 * instead of `export core = (existing) => ({ ...existing, someConfig })`,
 * just overwriting everything and not merging with the existing values.
 */
export const core = async (existing: CoreConfig, options: Options): Promise<CoreConfig> => ({
  ...existing,
  disableTelemetry: options.disableTelemetry === true || options.test === true,
  enableCrashReports:
    options.enableCrashReports || optionalEnvToBoolean(process.env.STORYBOOK_ENABLE_CRASH_REPORTS),
});

export const previewAnnotations = async (base: any, options: Options) => {
  const config = await options.presets.apply('config', [], options);

  if (config.length > 0) {
    deprecate(
      `You (or an addon) are using the 'config' preset field. This has been replaced by 'previewAnnotations' and will be removed in 8.0`
    );
  }

  return [...config, ...base];
};

export const features = async (
  existing: StorybookConfig['features']
): Promise<StorybookConfig['features']> => ({
  ...existing,
  warnOnLegacyHierarchySeparator: true,
  buildStoriesJson: false,
  storyStoreV7: true,
  argTypeTargetsV7: true,
  legacyDecoratorFileOrder: false,
  disallowImplicitActionsInRenderV8: false,
});

export const csfIndexer: Indexer = {
  test: /(stories|story)\.(m?js|ts)x?$/,
  createIndex: async (fileName, options) => (await readCsf(fileName, options)).parse().indexInputs,
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_indexers: StorybookConfig['experimental_indexers'] = (existingIndexers) =>
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

export const docs = (
  docsOptions: StorybookConfig['docs'],
  { docs: docsMode }: CLIOptions
): StorybookConfig['docs'] =>
  docsOptions && docsMode !== undefined
    ? {
        ...docsOptions,
        docsMode,
      }
    : docsOptions;

export const managerHead = async (_: any, options: Options) => {
  const location = join(options.configDir, 'manager-head.html');
  if (await pathExists(location)) {
    const contents = readFile(location, 'utf-8');
    const interpolations = options.presets.apply('env');

    return interpolate(await contents, await interpolations);
  }

  return '';
};

const WHATS_NEW_CACHE = 'whats-new-cache';
const WHATS_NEW_URL = 'https://storybook.js.org/whats-new/v1';

// Grabbed from the implementation: https://github.com/storybookjs/dx-functions/blob/main/netlify/functions/whats-new.ts
type WhatsNewResponse = {
  title: string;
  url: string;
  blogUrl?: string;
  publishedAt: string;
  excerpt: string;
};

type OptionsWithRequiredCache = Exclude<Options, 'cache'> & Required<Pick<Options, 'cache'>>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_serverChannel = async (
  channel: Channel,
  options: OptionsWithRequiredCache
) => {
  const coreOptions = await options.presets.apply('core');

  channel.on(SET_WHATS_NEW_CACHE, async (data: WhatsNewCache) => {
    const cache: WhatsNewCache = await options.cache.get(WHATS_NEW_CACHE).catch((e) => {
      logger.verbose(e);
      return {};
    });
    await options.cache.set(WHATS_NEW_CACHE, { ...cache, ...data });
  });

  channel.on(REQUEST_WHATS_NEW_DATA, async () => {
    try {
      const post = (await fetch(WHATS_NEW_URL).then(async (response) => {
        if (response.ok) return response.json();
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw response;
      })) as WhatsNewResponse;

      const configFileName = findConfigFile('main', options.configDir);
      if (!configFileName)
        throw new Error(`unable to find storybook main file in ${options.configDir}`);
      const main = await readConfig(configFileName);
      const disableWhatsNewNotifications = main.getFieldValue([
        'core',
        'disableWhatsNewNotifications',
      ]);

      const cache: WhatsNewCache = (await options.cache.get(WHATS_NEW_CACHE)) ?? {};
      const data = {
        ...post,
        status: 'SUCCESS',
        postIsRead: post.url === cache.lastReadPost,
        showNotification: post.url !== cache.lastDismissedPost && post.url !== cache.lastReadPost,
        disableWhatsNewNotifications,
      } satisfies WhatsNewData;
      channel.emit(RESULT_WHATS_NEW_DATA, { data });
    } catch (e) {
      logger.verbose(e instanceof Error ? e.message : String(e));
      channel.emit(RESULT_WHATS_NEW_DATA, {
        data: { status: 'ERROR' } satisfies WhatsNewData,
      });
    }
  });

  channel.on(
    TOGGLE_WHATS_NEW_NOTIFICATIONS,
    async ({ disableWhatsNewNotifications }: { disableWhatsNewNotifications: boolean }) => {
      const isTelemetryEnabled = coreOptions.disableTelemetry !== true;
      try {
        const mainPath = findConfigFile('main', options.configDir);
        invariant(mainPath, `unable to find storybook main file in ${options.configDir}`);
        const main = await readConfig(mainPath);
        main.setFieldValue(['core', 'disableWhatsNewNotifications'], disableWhatsNewNotifications);
        await fs.writeFile(mainPath, printConfig(main).code);
        if (isTelemetryEnabled) {
          await telemetry('core-config', { disableWhatsNewNotifications });
        }
      } catch (error) {
        invariant(error instanceof Error);
        if (isTelemetryEnabled) {
          await sendTelemetryError(error, 'core-config', {
            cliOptions: options,
            presetOptions: { ...options, corePresets: [], overridePresets: [] },
            skipPrompt: true,
          });
        }
      }
    }
  );

  channel.on(TELEMETRY_ERROR, async (error) => {
    const isTelemetryEnabled = coreOptions.disableTelemetry !== true;

    if (isTelemetryEnabled) {
      await sendTelemetryError(error, 'browser', {
        cliOptions: options,
        presetOptions: { ...options, corePresets: [], overridePresets: [] },
        skipPrompt: true,
      });
    }
  });

  return channel;
};
