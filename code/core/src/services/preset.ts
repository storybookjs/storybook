import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { getBabelPresetEnvMajor, STORY_FILE_TEST_REGEXP } from '@storybook/core/internal/common';
import { loadCsf } from '@storybook/core/internal/csf-tools';
import { logger } from '@storybook/core/internal/node-logger';
import type {
  Indexer,
  PresetPropertyFn,
  ServerApp,
  StorybookConfigRaw,
} from '@storybook/core/internal/types';

import * as pathe from 'pathe';

import { mapStaticDir } from '../common/utils/server-statics.ts';
import type { Storybook } from '../instance/types.ts';
import { OpenServiceServicesAppliedTwiceError } from '../server-errors.ts';
import { getInstanceContext } from '../shared/instance-context.ts';
import { registerModuleGraphService } from '../shared/open-service/services/module-graph/server.ts';
import { registerToolset } from '../shared/open-service/toolset-registry.ts';
import { createStoriesToolset } from '../shared/open-service/toolsets/stories/definition.ts';
import { getDevServerSubscriptions } from './dev-server-subscriptions.ts';
import { GitDiffProvider } from './change-detection/GitDiffProvider.ts';
import { getChangeDetectionReadiness } from './change-detection/readiness.ts';
import { getSyncedStatuses } from './stores/status.ts';
import { applyServicesPresetOnce } from './apply-services-preset-once.ts';

const SERVICES_LOADED = Symbol.for('storybook.instance.services-loaded');

const babelPresetEnvMajor = getBabelPresetEnvMajor();

/** Core's feature defaults; `docgenServer` follows whether an addon can run a docgen provider. */
export async function features(
  existing: StorybookConfigRaw['features'],
  storybook: Pick<Storybook, 'callHook'>
): Promise<NonNullable<StorybookConfigRaw['features']> & { babelRemoveBugfixes: boolean }> {
  return {
    ...existing,
    argTypeTargetsV7: true,
    babelRemoveBugfixes: babelPresetEnvMajor ? babelPresetEnvMajor >= 8 : false,
    experimentalChunkedPreviewRuntime: false,
    docgenServer: await storybook.callHook('core:docgen-enabled:extend', false),
  };
}

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

/** Put the CSF indexer ahead of the indexers addons collected. */
export function experimental_indexers(existingIndexers: Indexer[] | undefined): Indexer[] {
  return [csfIndexer].concat(existingIndexers || []);
}

async function getHeadlessChangeDetectionAdapter(storybook: Storybook) {
  try {
    return storybook.builder?.changeDetectionAdapter(storybook);
  } catch (error) {
    logger.warn('Change detection: adapter initialisation failed');
    logger.debug(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return undefined;
  }
}

/** Registers core services on the current instance; services only exist inside one. */
export async function services(storybook: Storybook): Promise<void> {
  const context = getInstanceContext();
  if (!context) {
    throw new Error('The services preset can only be applied inside a Storybook instance.');
  }
  if (context.state.has(SERVICES_LOADED)) {
    throw new OpenServiceServicesAppliedTwiceError();
  }
  context.state.set(SERVICES_LOADED, true);

  const getIndex = () => storybook.getIndex();
  const { configDir } = storybook;

  registerModuleGraphService({
    channel: storybook.channel,
    getIndex,
    workingDir: context.workingDir,
    getImportParsers: () => storybook.callHook('core:import-parsers:collect', []),
    getAdapter: () => getHeadlessChangeDetectionAdapter(storybook),
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
        get: async () => storybook.callHook('core:story-render:extend', undefined),
      },
      // Real paths, because git reports the repo root as one; on Windows the cwd can differ in case.
      storybookDirs: {
        configDir: realpathSync.native(pathe.resolve(configDir)),
        getStaticDirs: async () =>
          ((await storybook.callHook('core:static-dirs:collect', [])) ?? []).flatMap(
            (staticDir) => {
              try {
                return [realpathSync.native(mapStaticDir(staticDir, configDir).staticPath)];
              } catch {
                // A missing directory throws here, and holds no changed files anyway.
                return [];
              }
            }
          ),
      },
    })
  );
}

/** Registers services if setup did not, then starts the dev-only service subscriptions. */
export async function experimental_devServer(
  app: ServerApp,
  storybook: Pick<Storybook, 'callHook'>
): Promise<ServerApp> {
  await applyServicesPresetOnce(storybook);
  for (const subscribe of getDevServerSubscriptions().splice(0)) {
    subscribe();
  }

  return app;
}

export const storyIndexGenerator: PresetPropertyFn<
  'storyIndexGenerator',
  StorybookConfigRaw
> = async () => {
  const context = getInstanceContext();
  if (!context) {
    throw new Error(
      'The storyIndexGenerator preset can only be applied inside a Storybook instance.'
    );
  }
  return context.getStoryIndexGenerator();
};
