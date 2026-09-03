import type { StoryIndex } from '../../../../types/modules/indexer.ts';
import { registerService } from '../../server.ts';
import { storyIndexServiceDef, type StoryIndexService } from './definition.ts';

/** What the service needs from `StoryIndexGenerator`, which satisfies it as-is. */
export interface StoryIndexSource {
  getIndex: () => Promise<StoryIndex>;
  onInvalidated: (listener: () => void) => () => void;
}

export interface RegisterStoryIndexServiceOptions {
  /**
   * Resolved on the first `_refresh`, never at registration: an attached caller registers this
   * service too, and resolving the generator there would index the project in the caller.
   */
  getSource: () => Promise<StoryIndexSource>;
}

/** Registers the `core/story-index` service in the server realm. */
export function registerStoryIndexService({
  getSource,
}: RegisterStoryIndexServiceOptions): StoryIndexService {
  // Counted in the listener itself, not in `_invalidate`: command handlers run after async input
  // validation, and a refresh finishing in that gap must still see the invalidation.
  let invalidations = 0;
  let storedFor = -1;
  let subscribed = false;

  const service = registerService(storyIndexServiceDef, {
    commands: {
      _refresh: {
        handler: async (_input, ctx) => {
          const source = await getSource();
          if (!subscribed) {
            subscribed = true;
            source.onInvalidated(() => {
              invalidations += 1;
              void service.commands._invalidate(undefined);
            });
          }

          let seen: number;
          let index: StoryIndex;
          do {
            seen = invalidations;
            index = await source.getIndex();
          } while (seen !== invalidations);

          storedFor = seen;
          ctx.self.setState((state) => {
            state.index = index;
          });
        },
      },
      _invalidate: {
        handler: async (_input, ctx) => {
          if (storedFor === invalidations) {
            return;
          }
          ctx.self.setState((state) => {
            state.index = undefined;
          });
        },
      },
    },
  });

  return service;
}
