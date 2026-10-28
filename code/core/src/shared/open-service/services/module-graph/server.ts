import type { ChannelLike } from '@storybook/core/internal/channels';
import { STORY_INDEX_INVALIDATED } from '@storybook/core/internal/core-events';
import type { Presets } from '@storybook/core/internal/types';

import { getInstanceContext, bindToInstance } from '../../../instance-context.ts';
import { registerService } from '../../server.ts';
import { registerModuleGraphIndexService } from '../module-graph-index/server.ts';
import { moduleGraphServiceDef, type ChangeDetectionReadinessResult } from './definition.ts';
import type { ChangeDetectionAdapter } from './engine/adapters/types.ts';
import { ModuleGraphEngine, type ModuleGraphEngineOptions } from './engine/module-graph-engine.ts';
import { errorToErrorLike } from './types.ts';

const INSTANCE_ADAPTER = Symbol.for('storybook.instance.module-graph-adapter');

export type RegisterModuleGraphServiceOptions = {
  channel: ChannelLike;
  getIndex: ModuleGraphEngineOptions['getIndex'];
  workingDir?: string;
  presets?: Presets;
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
  const resolve = getInstanceContext()?.state.get(INSTANCE_ADAPTER) as
    | ((adapter: ChangeDetectionAdapter | null | undefined) => void)
    | undefined;
  if (resolve) {
    resolve(adapter);
    return;
  }
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
 * Registers `core/module-graph-index` then `core/module-graph`, constructs the graph engine, wires
 * state mirroring into the service commands, and listens for story-index invalidation on the server
 * channel. The engine starts once {@link resolveChangeDetectionAdapter} provides the builder adapter,
 * or once the first `_waitForSettledEngine` call obtains one through
 * {@link RegisterModuleGraphServiceOptions.getAdapter}.
 *
 * The engine lives for the entire dev-server process, so there is no teardown path: the OS reclaims
 * everything when the process exits.
 */
export function registerModuleGraphService(options: RegisterModuleGraphServiceOptions) {
  const workingDir = options.workingDir ?? process.cwd();
  const context = getInstanceContext();
  const localAdapter = context ? createAdapterDeferred() : undefined;
  let localResolved = false;
  let closed = false;
  const adapterPromise = localAdapter?.promise ?? adapterDeferred.promise;
  const resolveAdapter = (adapter: ChangeDetectionAdapter | null | undefined): void => {
    if (localAdapter) {
      if (!localResolved) {
        localResolved = true;
        localAdapter.resolve(adapter);
      }
    } else {
      resolveChangeDetectionAdapter(adapter);
    }
  };
  context?.state.set(INSTANCE_ADAPTER, resolveAdapter);
  let engine: ModuleGraphEngine | undefined = undefined;
  let engineStarted = false;
  let obtainAdapter: Promise<void> | undefined;

  const indexRuntime = registerModuleGraphIndexService(workingDir);

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
        _waitForSettledEngine: {
          handler: async () => {
            await ensureAdapter();
            applyAdapter(await adapterPromise);
            await engine!.whenSettled();
          },
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
    onSnapshot: (storiesByFile) => {
      void runtime.commands._applyGraphSnapshot({ storiesByFile });
    },
    onIndex: (storiesByFile) => indexRuntime.commands._applyIndex({ storiesByFile }),
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
    if (engineStarted || closed) {
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

  async function ensureAdapter() {
    if (localAdapter ? localResolved : adapterResolved) {
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
          resolveAdapter(adapter);
        },
        () => {
          resolveAdapter(undefined);
        }
      );
    await obtainAdapter;
  }

  const onInvalidated = bindToInstance(() => engine!.onStoryIndexInvalidated());
  options.channel.on(STORY_INDEX_INVALIDATED, onInvalidated);
  context?.cleanups.add(async () => {
    closed = true;
    resolveAdapter(undefined);
    options.channel.off(STORY_INDEX_INVALIDATED, onInvalidated);
    await engine!.close();
  });

  void adapterPromise.then(bindToInstance(applyAdapter));

  return runtime;
}
