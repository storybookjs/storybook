import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import {
  STORY_FILE_TEST_REGEXP,
  normalizeStories,
  optionalEnvToBoolean,
} from 'storybook/internal/common';
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
  DocgenProvider,
  Indexer,
  Options,
  PresetProperty,
  PresetPropertyFn,
  StorybookConfigRaw,
} from 'storybook/internal/types';

import { registerDocgenService } from '../../shared/open-service/services/docgen/server.ts';
import { registerModuleGraphService } from '../../shared/open-service/services/module-graph/server.ts';

import { isAbsolute, join } from 'pathe';
import * as pathe from 'pathe';
import { dedent } from 'ts-dedent';

import { resolvePackageDir } from '../../shared/utils/module.ts';
import { initCreateNewStoryChannel } from '../server-channel/create-new-story-channel.ts';
import { initFileSearchChannel } from '../server-channel/file-search-channel.ts';
import { initGhostStoriesChannel } from '../server-channel/ghost-stories-channel.ts';
import { initOpenInEditorChannel } from '../server-channel/open-in-editor-channel.ts';
import { initTelemetryChannel } from '../server-channel/telemetry-channel.ts';
import { initializeChecklist } from '../utils/checklist.ts';
import { defaultFavicon, defaultStaticDirs } from '../utils/constants.ts';
import { initializeSaveStory } from '../utils/save-story/save-story.ts';
import { parseStaticDir } from '../utils/server-statics.ts';
import { type OptionsWithRequiredCache, initializeWhatsNew } from '../utils/whats-new.ts';
import { getWsToken } from './wsToken.ts';
import { initAIAnalyticsChannel } from '../server-channel/ai-setup-channel.ts';

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

export const features: PresetProperty<'features'> = async (existing) => ({
  ...existing,
  actions: true,
  argTypeTargetsV7: true,
  backgrounds: true,
  changeDetection: true,
  componentsManifest: false,
  controls: true,
  disallowImplicitActionsInRenderV8: true,
  highlight: true,
  interactions: true,
  legacyDecoratorFileOrder: false,
  measure: true,
  outline: true,
  sidebarOnboardingChecklist: true,
  viewport: true,
});

export const csfIndexer: Indexer = {
  test: STORY_FILE_TEST_REGEXP,
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
  initAIAnalyticsChannel(channel, options, () => storyIndexGeneratorPromise);
  initializeChecklist(channel, () => storyIndexGeneratorPromise, options.configDir);
  initializeWhatsNew(channel, options);
  initializeSaveStory(channel, options);
  initFileSearchChannel(channel, options);
  initCreateNewStoryChannel(channel, options);
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
    pathe.join(resolvePackageDir('storybook'), 'dist/core-server/presets/common-manager.js'),
    ...(existing || []),
  ];
};

globalThis.STORYBOOK_SERVICES_LOADED = globalThis.STORYBOOK_SERVICES_LOADED ?? false;

export const services = async (_value: void, options: Options): Promise<void> => {
  if (globalThis.STORYBOOK_SERVICES_LOADED) {
    throw new Error(
      'The "services" preset property was applied twice, but should only be applied once. Multiple code paths applying it will cause service registration to fail.'
    );
  }
  globalThis.STORYBOOK_SERVICES_LOADED = true;

  // `presets.apply` flattens the generator preset's returned promise, so this is the resolved
  // generator, not a promise.
  const storyIndexGenerator =
    await options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');

  registerModuleGraphService({
    channel: options.channel,
    getIndex: () => storyIndexGenerator.getIndex(),
    workingDir: process.cwd(),
    presets: options.presets,
  });

  const features = await options.presets.apply('features');

  // Skip when previewing is off — the docgen service's staticInputs depends on the story index,
  // so registering it would force full story-index generation during manager-only builds (and
  // produce docgen files that wouldn't be served anywhere). Mirrors the !options.ignorePreview
  // gate around index.json and writeManifests in build-static.ts.
  if (features?.experimentalDocgenServer && !options.ignorePreview) {
    const provider = await options.presets.apply<DocgenProvider>(
      'experimental_docgenProvider',
      /**
       * Seed provider for the experimental_docgenProvider middleware chain.
       *
       * Returns `undefined` so the bottom of the chain signals "no docgen here" — each upstream
       * provider can either replace this with its own payload, return its own undefined, or call
       * `nextDocgen` and merge with downstream output.
       */
      async () => undefined
    );

    registerDocgenService({
      getIndex: () => storyIndexGenerator.getIndex(),
      provider,
      workingDir: process.cwd(),
    });
  }
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
