import type { ChannelLike } from 'storybook/internal/channels';
import { STORY_INDEX_INVALIDATED } from 'storybook/internal/core-events';
import type { Presets } from 'storybook/internal/types';

import type { StoryIndexGenerator } from '../../../../core-server/utils/StoryIndexGenerator.ts';
import { registerService } from '../../service-registration.ts';
import { changeDetectionAdapterPromise } from './adapter-bridge.ts';
import { setDependencyGraphService } from './active-service-registry.ts';
import { moduleGraphServiceDef } from './definition.ts';
import { ModuleGraphEngine } from './engine/ModuleGraphEngine.ts';

export type RegisterModuleGraphServiceOptions = {
  channel: ChannelLike;
  storyIndexGeneratorPromise: Promise<StoryIndexGenerator>;
  workingDir?: string;
  presets?: Presets;
};

let engineInstance: ModuleGraphEngine | undefined;
let unsubscribeStoryIndex: (() => void) | undefined;

/**
 * Registers the `core/module-graph` open service, constructs the graph engine, wires state mirroring,
 * listens for story-index invalidation on the server channel, and starts the engine once the builder
 * adapter is provided.
 */
export function registerModuleGraphService(options: RegisterModuleGraphServiceOptions) {
  const runtime = registerService(moduleGraphServiceDef, {
    queries: {
      getReady: {
        load: async (_input, ctx) => {
          const engine = engineInstance;
          if (engine) {
            await engine.whenSettled();
          }
          void ctx;
        },
      },
    },
  });

  const engine = new ModuleGraphEngine({
    storyIndexGeneratorPromise: options.storyIndexGeneratorPromise,
    workingDir: options.workingDir,
    presets: options.presets,
    onSnapshot: (storiesByFile) => {
      void runtime.commands.applyGraphSnapshot({ storiesByFile });
    },
    onUpdate: ({ storiesByFile, bumpedStoryFiles }) => {
      void runtime.commands.applyGraphUpdate({ storiesByFile, bumpedStoryFiles });
    },
  });

  engineInstance = engine;
  setDependencyGraphService(engine);

  unsubscribeStoryIndex = options.channel.on(STORY_INDEX_INVALIDATED, () => {
    engine.onStoryIndexInvalidated();
  });

  engine.run(() => changeDetectionAdapterPromise);

  return runtime;
}

/** @internal — tears down channel subscription and engine (dev-server shutdown). */
export async function disposeModuleGraphService(): Promise<void> {
  unsubscribeStoryIndex?.();
  unsubscribeStoryIndex = undefined;
  await engineInstance?.dispose().catch(() => undefined);
  engineInstance = undefined;
  setDependencyGraphService(undefined);
}
