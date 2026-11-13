import { realpathSync, statSync } from 'node:fs';

import { normalize } from 'pathe';

import type { ChannelLike } from 'storybook/internal/channels';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { Presets } from 'storybook/internal/types';

import { registerService } from '../../server.ts';
import { moduleGraphServiceDef, type ChangeDetectionReadinessResult } from './definition.ts';
import type { ChangeDetectionAdapter } from './engine/adapters/types.ts';
import { ModuleGraphEngine, type ModuleGraphEngineOptions } from './engine/module-graph-engine.ts';
import { errorToErrorLike, lookupStoriesForFiles } from './types.ts';

// The graph keys files by their real path, so a symlinked entry is followed before the walk.
function canonical(path: string): string {
  try {
    return normalize(realpathSync.native(path));
  } catch {
    return normalize(path);
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export type RegisterModuleGraphServiceOptions = {
  channel: ChannelLike;
  getIndex: ModuleGraphEngineOptions['getIndex'];
  workingDir?: string;
  presets?: Presets;
  /**
   * Absolute paths of what the preview loads: the preview file and the preview annotations, whose
   * imports count too, and the config directory, whose files all count.
   */
  getPreviewEntries?: () => Promise<string[]>;
  getAdapter?: () => Promise<ChangeDetectionAdapter | null | undefined>;
  getChangeDetectionReadiness?: () => Promise<
    Exclude<ChangeDetectionReadinessResult, { status: 'pending' }>
  >;
};

type AdapterDeferred = {
  promise: Promise<ChangeDetectionAdapter | null | undefined>;
  resolve: (adapter: ChangeDetectionAdapter | null | undefined) => void;
};

function createAdapterDeferred(): AdapterDeferred {
  let resolve!: (adapter: ChangeDetectionAdapter | null | undefined) => void;
  return {
    promise: new Promise((fulfill) => {
      resolve = fulfill;
    }),
    resolve,
  };
}

/**
 * Deferred builder adapter. Open-service registration runs early in the dev-server boot, but the
 * preview builder that produces the {@link ChangeDetectionAdapter} is only ready later. The
 * dev-server resolves this once the adapter exists; the engine awaits it before building the graph.
 *
 * `resolveChangeDetectionAdapter` is exported directly (rather than wrapped in a helper) so the
 * dev-server can resolve the promise with one import.
 */
let adapterDeferred = createAdapterDeferred();
let adapterResolved = false;

export function resolveChangeDetectionAdapter(
  adapter: ChangeDetectionAdapter | null | undefined
): void {
  if (adapterResolved) {
    return;
  }
  adapterResolved = true;
  adapterDeferred.resolve(adapter);
}

export function resetChangeDetectionAdapterForTests(): void {
  adapterDeferred = createAdapterDeferred();
  adapterResolved = false;
}

/**
 * Registers `core/module-graph`, constructs the graph engine, wires state mirroring into the service
 * commands, and listens for story-index invalidation on the server channel. The engine starts once
 * {@link resolveChangeDetectionAdapter} provides the builder adapter, or once the first
 * `_waitForSettledEngine` call obtains one through
 * {@link RegisterModuleGraphServiceOptions.getAdapter}.
 *
 * The engine lives for the entire dev-server process, so there is no teardown path: the OS reclaims
 * everything when the process exits.
 */
export function registerModuleGraphService(options: RegisterModuleGraphServiceOptions) {
  const workingDir = options.workingDir ?? process.cwd();
  const adapterPromise = adapterDeferred.promise;
  let engine: ModuleGraphEngine | undefined = undefined;
  let engineStarted = false;
  let obtainAdapter: Promise<void> | undefined;

  const runtime = registerService(
    {
      ...moduleGraphServiceDef,
      initialState: {
        ...moduleGraphServiceDef.initialState,
        workingDir,
      },
    },
    {
      commands: {
        storiesForFiles: {
          handler: async (input) => {
            await waitForSettledEngine();
            return lookupStoriesForFiles(engine!, input.files, workingDir);
          },
        },
        loadedByPreview: {
          handler: async (input) => {
            await waitForSettledEngine();
            const entries = ((await options.getPreviewEntries?.()) ?? []).map(canonical);
            // A directory entry (the config directory) covers every file in it: `main.ts` and
            // `vitest.setup.ts` affect every story without being imported by one.
            const directories = entries.filter(isDirectory).map((dir) => `${dir}/`);
            const loaded = await engine!.filesReachableFrom(entries);
            return input.files.map((file) => {
              const path = normalize(file);
              return loaded.has(path) || directories.some((dir) => path.startsWith(dir));
            });
          },
        },
        _waitForSettledEngine: {
          handler: waitForSettledEngine,
        },
        _waitForChangeDetectionReadiness: {
          handler: async (_input, ctx) => {
            const readiness = options.getChangeDetectionReadiness
              ? await options.getChangeDetectionReadiness()
              : { status: 'ready' as const };
            let serialized: Exclude<ChangeDetectionReadinessResult, { status: 'pending' }>;
            switch (readiness.status) {
              case 'ready':
                serialized = { status: 'ready' };
                break;
              case 'unavailable':
                serialized = {
                  status: 'unavailable',
                  reason: readiness.reason,
                  ...(readiness.error ? { error: { message: readiness.error.message } } : {}),
                };
                break;
              case 'error':
                serialized = {
                  status: 'error',
                  error: { message: readiness.error.message },
                };
                break;
              default: {
                const exhaustive: never = readiness;
                throw exhaustive;
              }
            }
            ctx.self.setState((state) => {
              state.changeDetectionReadiness = serialized;
            });
            return serialized;
          },
        },
      },
    }
  );

  engine = new ModuleGraphEngine({
    getIndex: options.getIndex,
    workingDir,
    presets: options.presets,
    onSnapshot: (storyFiles) => {
      void runtime.commands._applyGraphSnapshot({ storyFiles });
    },
    onBump: (bumpedStoryFiles, changedAt) =>
      runtime.commands._applyGraphUpdate({ bumpedStoryFiles, changedAt }),
    onError: (error) => {
      void runtime.commands._setStatus({ value: 'error', error: errorToErrorLike(error) });
    },
    onUnavailable: (reason, error) => {
      void runtime.commands._setStatus({
        value: 'unavailable',
        reason,
        ...(error ? { error: errorToErrorLike(error) } : {}),
      });
    },
  });

  function applyAdapter(adapter: ChangeDetectionAdapter | null | undefined) {
    if (engineStarted) {
      return;
    }
    engineStarted = true;
    if (!adapter) {
      void runtime.commands._setStatus({
        value: 'unavailable',
        reason: 'builder does not support change detection',
      });
      return;
    }
    engine!.start(adapter);
  }

  async function waitForSettledEngine() {
    await ensureAdapter();
    applyAdapter(await adapterPromise);
    await engine!.whenSettled();
  }

  async function ensureAdapter() {
    if (adapterResolved) {
      return;
    }
    const getAdapter = options.getAdapter;
    if (!getAdapter) {
      await adapterPromise;
      return;
    }
    obtainAdapter ??= Promise.resolve()
      .then(() => getAdapter())
      .then(
        (adapter) => {
          resolveChangeDetectionAdapter(adapter);
        },
        () => {
          resolveChangeDetectionAdapter(undefined);
        }
      );
    await obtainAdapter;
  }

  options.channel.on(STORY_INDEX_INVALIDATED, () => {
    engine!.onStoryIndexInvalidated();
  });

  void adapterPromise.then(applyAdapter);

  return runtime;
}
