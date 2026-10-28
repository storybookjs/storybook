import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import {
  getBabelPresetEnvMajor,
  normalizeStories,
  STORY_FILE_TEST_REGEXP,
} from '@storybook/core/internal/common';
import { loadCsf } from '@storybook/core/internal/csf-tools';
import { logger } from '@storybook/core/internal/node-logger';
import type {
  Indexer,
  Options,
  PresetProperty,
  PresetPropertyFn,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import * as pathe from 'pathe';

import { mapStaticDir } from '../common/utils/server-statics.ts';
import { StoryIndexGenerator } from '../story-index/StoryIndexGenerator.ts';
import { OpenServiceServicesAppliedTwiceError } from '../server-errors.ts';
import { getInstanceContext } from '../shared/instance-context.ts';
import { registerModuleGraphService } from '../shared/open-service/services/module-graph/server.ts';
import {
  registerReviewService,
  subscribeReviewToModuleGraphChanges,
} from '../shared/open-service/services/review/server.ts';
import { registerToolset } from '../shared/open-service/toolset-registry.ts';
import { reviewToolset } from '../shared/open-service/toolsets/review/definition.ts';
import { createStoriesToolset } from '../shared/open-service/toolsets/stories/definition.ts';
import { getDevServerSubscriptions } from './dev-server-subscriptions.ts';
import { GitDiffProvider } from './change-detection/GitDiffProvider.ts';
import { getChangeDetectionReadiness } from './change-detection/readiness.ts';
import { getSyncedStatuses } from './stores/status.ts';
import { applyServicesPresetOnce } from './apply-services-preset-once.ts';

const SERVICES_LOADED = Symbol.for('storybook.instance.services-loaded');

const babelPresetEnvMajor = getBabelPresetEnvMajor();

export const features: PresetProperty<'features'> = async (existing, options) => {
  const storybook = getInstanceContext()?.storybook;
  return {
    ...existing,
    actions: true,
    argTypeTargetsV7: true,
    babelRemoveBugfixes: babelPresetEnvMajor ? babelPresetEnvMajor >= 8 : false,
    backgrounds: true,
    componentsManifest: false,
    experimentalChunkedPreviewRuntime: false,
    controls: true,
    disallowImplicitActionsInRenderV8: true,
    docgenServer: storybook
      ? await storybook.callHook('core:docgen-enabled:extend', false)
      : await options.presets.apply('isDocgenProviderEnabled', false),
    highlight: true,
    interactions: true,
    measure: true,
    outline: true,
    menuOnboardingChecklist: true,
    sidebarOnboardingChecklist: true,
    viewport: true,
  };
};

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

async function getHeadlessChangeDetectionAdapter() {
  try {
    const storybook = getInstanceContext()?.storybook;
    return storybook?.builder?.changeDetectionAdapter(storybook);
  } catch (error) {
    logger.warn('Change detection: adapter initialisation failed');
    logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return undefined;
  }
}

/** Registers core services on the current instance; services only exist inside one. */
export const services = async (_value: void, options: Options): Promise<void> => {
  const context = getInstanceContext();
  if (!context) {
    throw new Error('The services preset can only be applied inside a Storybook instance.');
  }
  const devServerSubscriptions = getDevServerSubscriptions();
  if (context.state.has(SERVICES_LOADED)) {
    throw new OpenServiceServicesAppliedTwiceError();
  }
  context.state.set(SERVICES_LOADED, true);

  const getIndex = async () => {
    const generator = context.storybook
      ? await context.storybook.getStoryIndexGenerator()
      : await options.presets.apply<StoryIndexGenerator>('storyIndexGenerator');
    return generator.getIndex();
  };

  registerModuleGraphService({
    channel: options.channel,
    getIndex,
    workingDir: context.workingDir,
    presets: options.presets,
    getAdapter: () => getHeadlessChangeDetectionAdapter(),
    getChangeDetectionReadiness,
  });

  // Toolsets register imperatively alongside their services: addons contribute both from their own
  // `services` hook. The test toolset registers from addon-vitest, which owns the channel it needs.
  const storyIndex = { getIndex };
  const gitDiffProvider = new GitDiffProvider(context.workingDir);
  context.cleanups.add(() => gitDiffProvider.dispose());

  registerToolset(
    createStoriesToolset({
      storyIndex,
      git: {
        getRepoRoot: () => gitDiffProvider.getRepoRoot(),
        getChangedFiles: () => gitDiffProvider.getChangedFiles(),
      },
      changeStatuses: { getAll: getSyncedStatuses },
      storyRender: {
        get: async () => context.storybook?.callHook('core:story-render:extend', undefined),
      },
      // Real paths, because git reports the repo root as one; on Windows the cwd can differ in case.
      storybookDirs: {
        configDir: realpathSync.native(pathe.resolve(options.configDir)),
        getStaticDirs: async () =>
          (
            (context.storybook
              ? await context.storybook.callHook('core:static-dirs:collect', [])
              : await options.presets.apply('staticDirs')) ?? []
          ).flatMap((staticDir) => {
            try {
              return [realpathSync.native(mapStaticDir(staticDir, options.configDir).staticPath)];
            } catch {
              // A missing directory throws here, and holds no changed files anyway.
              return [];
            }
          }),
      },
    })
  );

  registerReviewService({
    getIndex,
  });
  devServerSubscriptions.push(subscribeReviewToModuleGraphChanges);
  registerToolset(reviewToolset);
};

export const experimental_devServer: PresetPropertyFn<'experimental_devServer'> = async (
  app,
  options
) => {
  await applyServicesPresetOnce(options.presets);
  for (const subscribe of getDevServerSubscriptions().splice(0)) {
    subscribe();
  }

  return app;
};

// Store the promise (not the result) to prevent race conditions.
// The promise is assigned synchronously, so concurrent calls will share the same initialization.
// This is essentially an async singleton pattern.
export let storyIndexGeneratorPromise: Promise<StoryIndexGenerator> | undefined;
export const storyIndexGenerator: PresetPropertyFn<
  'storyIndexGenerator',
  StorybookConfigRaw
> = async (_, options) => {
  const context = getInstanceContext();
  if (context) {
    return context.getStoryIndexGenerator();
  }
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
      storySorts: await options.presets.apply('storySorts', []),
    });
    await generator.initialize();
    return generator;
  })();

  return storyIndexGeneratorPromise;
};
