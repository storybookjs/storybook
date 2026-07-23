import type { StoryIndex } from 'storybook/internal/types';

import type { StatusesByStoryIdAndTypeId } from '../../../status-store/index.ts';
import { registerPublicApi } from '../../../public-api/index.ts';
import { createStoriesApi, type FindByComponentOutput } from './definition.ts';

/**
 * Dependencies for stories API handlers.
 *
 * Wired by core-server / common-preset once story index, change detection, and
 * module-graph reverse lookups are available. Tests can supply lightweight doubles.
 */
export type RegisterStoriesApiOptions = {
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

/** Registers the public stories API with injected runtime dependencies. */
export function registerStoriesApi(options: RegisterStoriesApiOptions) {
  const storiesApi = createStoriesApi(options);
  registerPublicApi([storiesApi]);
  return storiesApi;
}
