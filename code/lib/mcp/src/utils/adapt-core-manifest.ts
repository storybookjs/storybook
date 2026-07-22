import type { ComponentManifest, CoreDocgenComponent, CoreMdxDoc, Doc, Story } from '../types.ts';

/**
 * Adapts Storybook's `experimentalDocgenServer` open-service payloads (the "core
 * format") into `@storybook/mcp`'s internal {@link ComponentManifest}/{@link Doc}
 * shapes. This is the single place that bridges the two formats, used by both the
 * ref-resolution path (built/static/remote manifests) and the addon's in-process
 * `resolveEntry` hook (dev).
 *
 * Only `argTypes` is dropped: prop types still come from `reactComponentMeta` and
 * the `react*` docgen-engine fields, which are passed through unchanged.
 */

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
export function adaptCoreDoc(doc: CoreMdxDoc): Doc {
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
			Object.entries(docs).map(([id, doc]) => [id, adaptCoreDoc(doc)]),
		);
	}

	return component;
}
