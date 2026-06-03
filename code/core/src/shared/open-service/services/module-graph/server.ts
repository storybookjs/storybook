import type { ChannelLike } from 'storybook/internal/channels';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { Presets } from 'storybook/internal/types';

import { registerService } from '../../service-registration.ts';
import { setDependencyGraphService } from './active-service-registry.ts';
import { moduleGraphServiceDef } from './definition.ts';
import type { ChangeDetectionAdapter } from './engine/adapters/types.ts';
import { ModuleGraphEngine, type ModuleGraphEngineOptions } from './engine/module-graph-engine.ts';

export type RegisterModuleGraphServiceOptions = {
  channel: ChannelLike;
  getIndex: ModuleGraphEngineOptions['getIndex'];
  workingDir?: string;
  presets?: Presets;
};

/**
 * Deferred builder adapter. Open-service registration runs early in the dev-server boot, but the
 * preview builder that produces the {@link ChangeDetectionAdapter} is only ready later. The
 * dev-server resolves this once the adapter exists; the engine awaits it before building the graph.
 *
 * `resolveChangeDetectionAdapter` is exported directly (rather than wrapped in a helper) so the
 * dev-server can resolve the promise with one import.
 */
let resolveAdapter!: (adapter: ChangeDetectionAdapter) => void;

export const changeDetectionAdapterPromise = new Promise<ChangeDetectionAdapter>((resolve) => {
  resolveAdapter = resolve;
});

export function resolveChangeDetectionAdapter(adapter: ChangeDetectionAdapter): void {
  resolveAdapter(adapter);
}

/**
 * Registers the `core/module-graph` open service, constructs the graph engine, wires state mirroring
 * into the service commands, and listens for story-index invalidation on the server channel. The
 * engine starts once {@link resolveChangeDetectionAdapter} provides the builder adapter.
 *
 * The engine lives for the entire dev-server process, so there is no teardown path: the OS reclaims
 * everything when the process exits.
 */
export function registerModuleGraphService(options: RegisterModuleGraphServiceOptions) {
  let engine: ModuleGraphEngine | undefined;

  const runtime = registerService(moduleGraphServiceDef, {
    queries: {
      getReady: {
        // The graph builds (and patches) asynchronously, so `loaded()` callers await this barrier to
        // read a settled reverse index rather than a half-built one.
        load: async () => {
          await engine?.whenSettled();
        },
      },
    },
  });

  engine = new ModuleGraphEngine({
    getIndex: options.getIndex,
    workingDir: options.workingDir,
    presets: options.presets,
    onSnapshot: (storiesByFile) => {
      void runtime.commands.applyGraphSnapshot({ storiesByFile });
    },
    onUpdate: ({ storiesByFile, bumpedStoryFiles }) => {
      void runtime.commands.applyGraphUpdate({ storiesByFile, bumpedStoryFiles });
    },
  });

  setDependencyGraphService(engine);

  options.channel.on(STORY_INDEX_INVALIDATED, () => {
    engine?.onStoryIndexInvalidated();
  });

  void changeDetectionAdapterPromise.then((adapter) => {
    engine?.start(adapter);
  });

  return runtime;
}
