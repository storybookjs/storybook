import type { StoryIndex } from 'storybook/internal/types';

import { OpenServiceMissingOriginError } from '../../../../server-errors.ts';
import type { StatusesByStoryIdAndTypeId } from '../../../status-store/index.ts';
import { registerService } from '../../server.ts';
import { getChangedStories } from './changed.ts';
import type { FindByComponentOutput } from './definition.ts';
import { storiesServiceDef } from './definition.ts';
import { previewStories } from './preview.ts';

/**
 * Dependencies for `core/stories` command handlers.
 *
 * Wired by core-server / common-preset once story index, change detection, and
 * module-graph reverse lookups are available. Until then, callers can register
 * with test doubles or leave handlers unset (remote-only).
 */
export type RegisterStoriesServiceOptions = {
  getIndex: () => Promise<StoryIndex>;
  /** Storybook server origin used to build preview URLs (e.g. `http://localhost:6006`). */
  getOrigin: () => string;
  /** Change-detection statuses keyed by storyId → typeId → status. */
  getChangeStatuses: () => Promise<StatusesByStoryIdAndTypeId>;
  /** Working-tree files not reachable from any story (coverage gap signal). */
  detectUnreachableFiles: () => Promise<string[]>;
  /**
   * Resolves component paths to stories via the module graph (or a test double).
   * Prefer composing `findStoriesByComponent` from `./find-by-component.ts` with a
   * graph-backed `resolveMatches` when wiring common-preset.
   */
  findStoriesByComponent: (
    componentPaths: string[],
    maxDistance?: number
  ) => Promise<FindByComponentOutput>;
};

/**
 * Registers the `core/stories` open service with injected runtime dependencies.
 *
 * Does not wire itself into common-preset — callers must supply
 * {@link RegisterStoriesServiceOptions} (or pass a partial `registration` override).
 */
export function registerStoriesService(options: RegisterStoriesServiceOptions) {
  const {
    getIndex,
    getOrigin,
    getChangeStatuses,
    detectUnreachableFiles,
    findStoriesByComponent: findByComponent,
  } = options;

  return registerService(storiesServiceDef, {
    commands: {
      preview: {
        handler: async (input) => {
          const origin = getOrigin();
          if (!origin) {
            throw new OpenServiceMissingOriginError({
              serviceId: storiesServiceDef.id,
              operationName: 'preview',
            });
          }
          const index = await getIndex();
          return previewStories({ origin, index, stories: input.stories });
        },
      },
      changed: {
        handler: async () => {
          const [statuses, index, unreachableFiles] = await Promise.all([
            getChangeStatuses(),
            getIndex(),
            detectUnreachableFiles(),
          ]);
          return getChangedStories({ statuses, index, unreachableFiles });
        },
      },
      findByComponent: {
        handler: async (input) => {
          return findByComponent(input.componentPaths, input.maxDistance);
        },
      },
    },
  });
}
