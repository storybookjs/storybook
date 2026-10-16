import type { DocsToolset } from './toolsets/docs/definition.ts';
import type { ReviewToolset } from './toolsets/review/definition.ts';
import type { StoriesToolset } from './toolsets/stories/definition.ts';

/**
 * The public toolsets core can register, keyed by id.
 *
 * Mirrors `core-service-types.ts` for services: it is what makes `getToolset('stories')` return a
 * typed toolset instead of an opaque definition. A toolset registered by an addon under its own id
 * is still resolvable — it falls through to the untyped `getToolset` overload.
 */
export type KnownToolsets = {
  docs: DocsToolset;
  stories: StoriesToolset;
  review: ReviewToolset;
};
