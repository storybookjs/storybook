import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import type { Channel } from 'storybook/internal/channels';
import {
  JsPackageManagerFactory,
  type RemoveAddonOptions,
  STORY_FILE_TEST_REGEXP,
  getBabelPresetEnvMajor,
  getDirectoryFromWorkingDir,
  getPreviewBodyTemplate,
  getPreviewHeadTemplate,
  loadEnvs,
  normalizeStories,
  optionalEnvToBoolean,
  removeAddon as removeAddonBase,
} from 'storybook/internal/common';
import { StoryIndexGenerator } from 'storybook/internal/core-server';
import { loadCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import {
  CHANGE_DETECTION_STATUS_TYPE_ID,
  type CoreConfig,
  type DocgenProviderDescriptor,
  type Indexer,
  type Options,
  type PresetProperty,
  type PresetPropertyFn,
  type StoryDocsProvider,
  type StorybookConfigRaw,
} from 'storybook/internal/types';

import { OpenServiceServicesAppliedTwiceError } from '../../server-errors.ts';
import { registerDocgenService } from '../../shared/open-service/services/docgen/server.ts';
import { createDocgenWorkerClient } from '../../shared/open-service/services/docgen/worker/docgen-worker-client.ts';
import { registerModuleGraphService } from '../../shared/open-service/services/module-graph/server.ts';
import { registerReviewService } from '../../shared/open-service/services/review/server.ts';
import { registerStoryDocsService } from '../../shared/open-service/services/story-docs/server.ts';
import { createLocalDocsAccess } from '../../shared/open-service/toolsets/docs/access-local.ts';
import { registerToolset } from '../../shared/open-service/toolset-registry.ts';
import { createDocsToolset } from '../../shared/open-service/toolsets/docs/definition.ts';
import { reviewToolset } from '../../shared/open-service/toolsets/review/definition.ts';
import { createStoriesToolset } from '../../shared/open-service/toolsets/stories/definition.ts';
import { GitDiffProvider } from '../change-detection/GitDiffProvider.ts';
import { getChangeDetectionReadiness } from '../change-detection/readiness.ts';
import { getStatusStoreByTypeId } from '../stores/status.ts';
import { getPreviewBuilder } from '../utils/get-builders.ts';
import { loadManifests } from '../utils/manifests/manifests.ts';

import * as pathe from 'pathe';
import { isAbsolute, join } from 'pathe';
import { dedent } from 'ts-dedent';

import { resolvePackageDir } from '../../shared/utils/module.ts';
import { initAIAnalyticsChannel } from '../server-channel/ai-setup-channel.ts';
import { initCreateNewStoryChannel } from '../server-channel/create-new-story-channel.ts';
import { initFileSearchChannel } from '../server-channel/file-search-channel.ts';
import { initGhostStoriesChannel } from '../server-channel/ghost-stories-channel.ts';
import { initOpenInEditorChannel } from '../server-channel/open-in-editor-channel.ts';
import { isReviewExplicitlyEnabled, isReviewFeatureEnabled } from '../../shared/review/features.ts';
import { initTelemetryChannel } from '../server-channel/telemetry-channel.ts';
import { initializeChecklist } from '../utils/checklist.ts';
import { defaultFavicon, defaultStaticDirs } from '../utils/constants.ts';
import { initializeSaveStory } from '../utils/save-story/save-story.ts';
import { parseStaticDir } from '../utils/server-statics.ts';
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

const babelPresetEnvMajor = getBabelPresetEnvMajor();

export const features: PresetProperty<'features'> = async (existing) => ({
  ...existing,
  actions: true,
  argTypeTargetsV7: true,
  babelRemoveBugfixes: babelPresetEnvMajor ? babelPresetEnvMajor >= 8 : false,
  backgrounds: true,
  changeDetection: true,
  componentsManifest: false,
  controls: true,
  disallowImplicitActionsInRenderV8: true,
  // `experimentalReview` is deliberately NOT defaulted here. It is tri-state: MCP tooling
  // (`@storybook/addon-mcp`) enables review for the `storybook ai` CLI channel unless the user
  // explicitly sets `false`, so an explicit default would be indistinguishable from a user
  // opt-out in the merged preset. See `isReviewFeatureEnabled` in `shared/review/features.ts`.
  highlight: true,
  interactions: true,
  legacyDecoratorFileOrder: false,
  measure: true,
  outline: true,
  menuOnboardingChecklist: true,
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

async function getHeadlessChangeDetectionAdapter(options: Options) {
  try {
    const core = await options.presets.apply<CoreConfig>('core', {});
    if (!core?.builder) {
      return undefined;
    }
    const resolvedPreviewBuilder =
      typeof core.builder === 'string' ? core.builder : core.builder.name;
    const previewBuilder = await getPreviewBuilder(resolvedPreviewBuilder);
    return await previewBuilder.changeDetectionAdapter?.(options);
  } catch (error) {
    logger.warn('Change detection: adapter initialisation failed');
    logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return undefined;
  }
}

globalThis.STORYBOOK_SERVICES_LOADED = globalThis.STORYBOOK_SERVICES_LOADED ?? false;

export const services = async (_value: void, options: Options): Promise<void> => {
  if (globalThis.STORYBOOK_SERVICES_LOADED) {
    throw new OpenServiceServicesAppliedTwiceError();
  }
  globalThis.STORYBOOK_SERVICES_LOADED = true;

  const getIndex = () =>
    options.presets
      .apply<StoryIndexGenerator>('storyIndexGenerator')
      .then((generator) => generator.getIndex());

  registerModuleGraphService({
    channel: options.channel,
    getIndex,
    workingDir: process.cwd(),
    presets: options.presets,
    getAdapter: () => getHeadlessChangeDetectionAdapter(options),
    getChangeDetectionReadiness,
  });

  const features = await options.presets.apply('features');

  // Toolsets register imperatively alongside their services: addons contribute both from their own
  // `services` hook. The test toolset registers from addon-vitest, which owns the channel it needs.
  const storyIndex = { getIndex };
  const gitDiffProvider = new GitDiffProvider(process.cwd());

  registerToolset(
    createStoriesToolset({
      storyIndex,
      git: {
        getRepoRoot: () => gitDiffProvider.getRepoRoot(),
        getChangedFiles: () => gitDiffProvider.getChangedFiles(),
      },
      changeStatuses: {
        getAll: () => getStatusStoreByTypeId(CHANGE_DETECTION_STATUS_TYPE_ID).getAll(),
      },
      // The explicit opt-in gate, not `isReviewFeatureEnabled`: with the flag unset the review
      // infrastructure below still registers (the `storybook ai` CLI channel enables the tool per
      // request), but direct MCP clients never see `review-create`, so the stories prose must
      // not point at it.
      reviewEnabled: isReviewExplicitlyEnabled(features),
    })
  );

  if (isReviewFeatureEnabled(features)) {
    registerReviewService({
      getIndex,
    });
    registerToolset(reviewToolset);
  }

  // Skip when previewing is off — the docgen service's staticInputs depends on the story index,
  // so registering it would force full story-index generation during manager-only builds (and
  // produce docgen files that wouldn't be served anywhere). Mirrors the !options.ignorePreview
  // gate around index.json and writeManifests in build-static.ts.
  if (features?.experimentalDocgenServer && !options.ignorePreview) {
    const [docgenDescriptors, storyDocsProvider] = await Promise.all([
      options.presets.apply<DocgenProviderDescriptor[]>('experimental_docgenProvider', []),
      options.presets.apply<StoryDocsProvider>(
        'experimental_storyDocsProvider',
        async () => undefined
      ),
    ]);

    // Docgen extraction runs in a long-lived worker so its CPU-bound TypeScript work never starves
    // the dev-server event loop. The worker composes the descriptor chain; here we forward one
    // component to it. When the compiled worker script is unavailable (e.g. running from source
    // without a build) the client is undefined and we skip docgen registration rather than
    // extracting on the main thread.
    const docgenWorker =
      docgenDescriptors.length > 0 ? createDocgenWorkerClient(docgenDescriptors) : undefined;

    if (docgenWorker) {
      registerDocgenService({
        getIndex,
        docgenProvider: (input) => docgenWorker.extract(input.entry),
        workingDir: process.cwd(),
      });
    }

    // Story-docs registers whenever this block runs, docgen only when a worker is available, so
    // docgen registered ⇒ story-docs registered. `createLocalDocsAccess` requires both before
    // reading from the services and degrades to the manifests otherwise, so reordering or gating
    // these registrations cannot make the docs toolset throw — only fall back.
    registerStoryDocsService({
      getIndex,
      storyDocsProvider,
      workingDir: process.cwd(),
    });
  }

  registerToolset(
    createDocsToolset({
      // Registration-based selection between the docgen services and the inline manifests, shared
      // with addon-mcp's composed local source so both read this Storybook the same way.
      docsAccess: createLocalDocsAccess({
        storyIndex,
        getManifests: () => loadManifests(options.presets),
      }),
    })
  );
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

    const [indexers, docs, features] = await Promise.all([
      options.presets.apply('experimental_indexers', []),
      options.presets.apply('docs'),
      options.presets.apply('features'),
    ]);

    const generator = new StoryIndexGenerator(normalizedStories, {
      workingDir,
      configDir,
      indexers,
      docs,
      features,
    });
    await generator.initialize();
    return generator;
  })();

  return storyIndexGeneratorPromise;
};
