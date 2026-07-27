/**
 * Vendored (source-copied) manifest-assembly helpers from Storybook core.
 *
 * These are intentionally copied rather than imported so `@storybook/addon-mcp`
 * does not couple to internal core exports that vary across prereleases (the only
 * runtime core dependency is a guarded `getService`, see `service-access.ts`).
 *
 * Provenance — keep aligned with these upstream sources:
 *  - `core/src/common/utils/select-component-entry.ts`
 *    (`selectComponentEntriesByComponentId`, `getStoryImportPathFromEntry`,
 *    `STORY_FILE_TEST_REGEXP`)
 *  - `core/src/common/utils/component-id.ts` (`getComponentIdFromEntry`)
 *  - `core/src/shared/constants/tags.ts` (`Tag`)
 *  - `core/src/shared/open-service/services/docgen/paths.ts`,
 *    `.../story-docs/paths.ts`,
 *    `core/src/core-server/utils/manifests/mdx-manifest.ts` (ref path helpers)
 */

import type { DocsIndexEntry, IndexEntry } from 'storybook/internal/types';

/** System tags used by Storybook for categorizing stories and docs entries. */
export const Tag = {
	ATTACHED_MDX: 'attached-mdx',
	UNATTACHED_MDX: 'unattached-mdx',
	MANIFEST: 'manifest',
} as const;

/** Open-service ids (also the on-disk directory names under `services/`). */
export const DOCGEN_SERVICE_ID = 'core/docgen';
export const STORY_DOCS_SERVICE_ID = 'core/story-docs';
export const MDX_SERVICE_ID = 'addon-docs/mdx';

/**
 * Derives the componentId portion of a story index entry id. Story ids have the
 * shape `<componentId>--<storyName>`; the prefix before the first `--` is the
 * stable component identifier.
 */
export function getComponentIdFromEntry(entry: Pick<IndexEntry, 'id'>): string {
	return entry.id.split('--')[0] ?? entry.id;
}

function isAttachedDocsEntry(
	entry: IndexEntry,
): entry is DocsIndexEntry & { storiesImports: [string, ...string[]] } {
	return (
		entry.type === 'docs' &&
		entry.tags?.includes(Tag.ATTACHED_MDX) === true &&
		(entry as DocsIndexEntry).storiesImports.length > 0
	);
}

function isEligibleStoryEntry(entry: IndexEntry): boolean {
	return entry.type === 'story' && entry.subtype === 'story';
}

/**
 * Picks one index entry per componentId: story entries win; attached docs fill gaps
 * only where no story exists for that componentId.
 */
export function selectComponentEntriesByComponentId(
	indexEntries: IndexEntry[],
): Map<string, IndexEntry> {
	const entriesByComponentId = new Map<string, IndexEntry>();

	for (const entry of indexEntries) {
		if (!isEligibleStoryEntry(entry)) {
			continue;
		}
		entriesByComponentId.set(getComponentIdFromEntry(entry), entry);
	}

	for (const entry of indexEntries) {
		if (!isAttachedDocsEntry(entry)) {
			continue;
		}
		const componentId = getComponentIdFromEntry(entry);
		if (!entriesByComponentId.has(componentId)) {
			entriesByComponentId.set(componentId, entry);
		}
	}

	return entriesByComponentId;
}

/** `$ref` target for one component's docgen payload, relative to `manifests/`. */
export function docgenManifestRef(id: string): string {
	return `../services/${DOCGEN_SERVICE_ID}/${id}.json#/components/${id}`;
}

/** `$ref` target for one component's story-docs payload, relative to `manifests/`. */
export function storyDocsManifestRef(id: string): string {
	return `../services/${STORY_DOCS_SERVICE_ID}/${id}.json#/components/${id}`;
}

/** `$ref` target for one MDX doc, relative to `manifests/`. */
export function mdxManifestRef(componentId: string, docId: string): string {
	return `../services/${MDX_SERVICE_ID}/${componentId}.json#/components/${componentId}/docs/${docId}`;
}
