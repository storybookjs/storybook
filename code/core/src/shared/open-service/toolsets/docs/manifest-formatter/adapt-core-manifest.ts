import type { DocgenPayload } from '../../../services/docgen/types.ts';
import type { StoryDocsById } from '../../../services/story-docs/types.ts';
import type { MdxDoc } from '../map.ts';
import type { ComponentManifest, Doc, Story } from './manifest-types.ts';

/**
 * Adapts the `experimentalDocgenServer` open-service payloads into the manifest formatter's
 * {@link ComponentManifest}/{@link Doc} shapes.
 *
 * Only `argTypes` is dropped: the props section comes from `apiDescription` when the framework
 * authored one, else from the `react*` docgen-engine fields. All of those pass through unchanged.
 */

/**
 * A component assembled from the `core/docgen` payload plus the `core/story-docs` stories and
 * resolved attached MDX docs.
 */
export type CoreDocgenComponent = Partial<Omit<DocgenPayload, 'id' | 'name'>> & {
  id: string;
  name: string;
  import?: string;
  /** Story snippets, either as a story-docs record or an already-resolved array. */
  stories?: StoryDocsById | Story[];
  /** Attached docs keyed by doc id (resolved MDX payloads). */
  docs?: Record<string, MdxDoc>;
};

const ARG_TYPES_KEY = 'argTypes';

/** Converts the story-docs `stories` record (or an already-resolved array) into `Story[]`. */
export function adaptCoreStories(stories: CoreDocgenComponent['stories']): Story[] | undefined {
  if (!stories) {
    return undefined;
  }
  if (Array.isArray(stories)) {
    return stories;
  }
  return Object.values(stories);
}

/** Adapts one MDX service payload into a {@link Doc}. */
export function adaptCoreDoc(doc: MdxDoc): Doc {
  return { ...doc };
}

/** Adapts a core-format component (docgen + story-docs + attached MDX) into a {@link ComponentManifest}. */
export function adaptCoreComponent(core: CoreDocgenComponent): ComponentManifest {
  const { stories, docs, [ARG_TYPES_KEY]: _argTypes, ...rest } = core;
  const component = { ...rest } as ComponentManifest;

  const adaptedStories = adaptCoreStories(stories);
  if (adaptedStories) {
    component.stories = adaptedStories;
  }

  if (docs) {
    component.docs = Object.fromEntries(
      Object.entries(docs).map(([id, doc]) => [id, adaptCoreDoc(doc)])
    );
  }

  return component;
}
