import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import { normalizeStories, optionalEnvToBoolean } from 'storybook/internal/common';
import {
  JsPackageManagerFactory,
  type RemoveAddonOptions,
  getDirectoryFromWorkingDir,
  getPreviewBodyTemplate,
  getPreviewHeadTemplate,
  loadEnvs,
  removeAddon as removeAddonBase,
} from 'storybook/internal/common';
import { StoryIndexGenerator } from 'storybook/internal/core-server';
import { loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type {
  CoreConfig,
  Indexer,
  Options,
  PresetProperty,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { isAbsolute, join } from 'pathe';
import * as pathe from 'pathe';
import { dedent } from 'ts-dedent';

import { resolvePackageDir } from '../../shared/utils/module';
import { initCreateNewStoryChannel } from '../server-channel/create-new-story-channel';
import { initFileSearchChannel } from '../server-channel/file-search-channel';
import { initGhostStoriesChannel } from '../server-channel/ghost-stories-channel';
import { initOpenInEditorChannel } from '../server-channel/open-in-editor-channel';
import { initTelemetryChannel } from '../server-channel/telemetry-channel';
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
    // https://storybook.js.org/docs/writing-tests/interaction-testing#run-code-before-each-story-in-a-file
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
const wsToken = randomUUID();
export const core = async (existing: CoreConfig, options: Options): Promise<CoreConfig> => ({
  ...existing,
  channelOptions: { ...(existing?.channelOptions ?? {}), wsToken },
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
  sidebarOnboardingChecklist: true,
});

export const csfIndexer: Indexer = {
  test: /(stories|story)\.(m?js|ts)x?$/,
  createIndex: async (fileName, options) => {
    const code = (await readFile(fileName, 'utf-8')).toString();
    if (code.trim().length === 0) {
      logger.debug(`The file ${fileName} is empty. Skipping indexing.`);
      return [];
    }
    return loadCsf(code, { ...options, fileName }).parse().indexInputs;
  },
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

export const channelToken = async (value: string | undefined) => {
  return value;
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
  initGhostStoriesChannel(channel, options, coreOptions);
  initOpenInEditorChannel(channel, options, coreOptions);
  initTelemetryChannel(channel, options);

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

// Store the promise (not the result) to prevent race conditions.
// The promise is assigned synchronously, so concurrent calls will share the same initialization.
// This is essentially an async singleton pattern.
let storyIndexGeneratorPromise: Promise<StoryIndexGenerator> | undefined;
export const storyIndexGenerator: PresetPropertyFn<
  'storyIndexGenerator',
  StorybookConfigRaw
> = async (_, options) => {
  if (storyIndexGeneratorPromise) {
    return storyIndexGeneratorPromise;
  }

  storyIndexGeneratorPromise = (async () => {
    const workingDir = process.cwd();
    const configDir = options.configDir;
    const stories = await options.presets.apply('stories');
    const normalizedStories = normalizeStories(stories, {
      configDir,
      workingDir,
    });

    const [indexers, docs] = await Promise.all([
      options.presets.apply('experimental_indexers', []),
      options.presets.apply('docs'),
    ]);

    const generator = new StoryIndexGenerator(normalizedStories, {
      workingDir,
      configDir,
      indexers,
      docs,
    });
    await generator.initialize();
    return generator;
  })();

  return storyIndexGeneratorPromise;
};
