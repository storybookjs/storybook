/**
 * In-process manifest access for Storybook's dev server when
 * `experimentalDocgenServer` is enabled.
 *
 * In that mode `/manifests/*.json` is deliberately 404'd by core and data lives in
 * the open services. Rather than fetch over loopback HTTP, this builds the shallow
 * list-all surface directly from the live services and additionally exposes a
 * `resolveEntry` hook so single-entry tools never trigger all-component docgen
 * extraction.
 */

import type { DocsIndexEntry, IndexEntry, Options, StoryIndex } from 'storybook/internal/types';
import {
	adaptCoreComponent,
	adaptCoreDoc,
	type CoreDocgenComponent,
	type CoreDocgenPayload,
	type CoreMdxDoc,
	type Doc,
	type ResolvedEntry,
	type Source,
} from '@storybook/mcp';

import { getStoryIndex } from '../utils/get-story-index.ts';
import {
	STORY_DOCS_SERVICE_ID,
	Tag,
	getComponentIdFromEntry,
	selectComponentEntriesByComponentId,
	storyDocsManifestRef,
} from './vendored.ts';
import { getDocgenService, getMdxService, getStoryDocsService } from './service-access.ts';

type ManifestProvider = (
	request: Request | undefined,
	path: string,
	source?: Source,
) => Promise<string>;

type ResolveEntry = (id: string, source?: Source) => Promise<ResolvedEntry | undefined>;

export interface DocgenServerManifestAccess {
	manifestProvider: ManifestProvider;
	resolveEntry: ResolveEntry;
}

interface IndexClassification {
	/** Component ids selected with the same rules as core's manifest generator. */
	componentIds: string[];
	/** Component ids backed by a story entry (so they have a story-docs payload). */
	storyBasedIds: Set<string>;
	/** Attached docs index entries grouped by owning component id. */
	attachedDocsByComponent: Map<string, DocsIndexEntry[]>;
	/** Standalone docs index entries keyed by their own id. */
	unattachedDocs: Map<string, DocsIndexEntry>;
}

function classifyIndex(index: StoryIndex): IndexClassification {
	const entries = Object.values(index.entries).filter(
		(entry): entry is IndexEntry => entry.tags?.includes(Tag.MANIFEST) ?? false,
	);
	const selected = selectComponentEntriesByComponentId(entries);

	const storyBasedIds = new Set<string>();
	for (const [id, entry] of selected) {
		if (entry.type === 'story') {
			storyBasedIds.add(id);
		}
	}

	const attachedDocsByComponent = new Map<string, DocsIndexEntry[]>();
	const unattachedDocs = new Map<string, DocsIndexEntry>();
	for (const entry of entries) {
		if (entry.type !== 'docs') {
			continue;
		}
		if (entry.tags?.includes(Tag.UNATTACHED_MDX)) {
			unattachedDocs.set(entry.id, entry);
		} else if (entry.tags?.includes(Tag.ATTACHED_MDX)) {
			const componentId = getComponentIdFromEntry(entry);
			const list = attachedDocsByComponent.get(componentId) ?? [];
			list.push(entry);
			attachedDocsByComponent.set(componentId, list);
		}
	}

	return {
		componentIds: [...selected.keys()],
		storyBasedIds,
		attachedDocsByComponent,
		unattachedDocs,
	};
}

/**
 * Builds the shallow `components.json` surface used by `list-all-documentation`.
 *
 * In dev, single component/doc lookups use `resolveEntry`, so this index does not
 * carry docgen or MDX refs. The only ref it exposes is `stories`, which
 * `list-all-documentation --withStoryIds` follows to avoid running full docgen.
 */
async function buildComponentsManifest(cls: IndexClassification): Promise<string> {
	const docgenService = await getDocgenService();
	// All components must be listed even without a prior extraction, so load (not just read).
	const allDocgen = docgenService
		? await docgenService.queries.getDocgenForAllComponents.loaded()
		: {};

	const components: Record<string, Record<string, unknown>> = {};
	for (const id of cls.componentIds) {
		const payload: CoreDocgenPayload | undefined = allDocgen[id];

		components[id] = {
			id,
			name: payload?.name ?? id,
			...(payload?.description !== undefined ? { description: payload.description } : {}),
			...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
			...(cls.storyBasedIds.has(id) ? { stories: { $ref: storyDocsManifestRef(id) } } : {}),
		};
	}

	return JSON.stringify({ v: 1, components });
}

/** Builds the ref-based unattached `docs.json` index, or `undefined` when there are none. */
async function buildDocsManifest(cls: IndexClassification): Promise<string | undefined> {
	if (cls.unattachedDocs.size === 0) {
		return undefined;
	}

	const mdxService = await getMdxService();
	const allMdx = mdxService ? await mdxService.queries.getMdxForAllComponents.loaded() : {};

	const docs: Record<string, Record<string, unknown>> = {};
	for (const [docId, entry] of cls.unattachedDocs) {
		const payload = allMdx[docId]?.docs?.[docId];
		docs[docId] = {
			id: docId,
			name: entry.name,
			...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
		};
	}

	return JSON.stringify({ v: 1, docs });
}

const STORY_DOCS_SERVICE_PREFIX = `services/${STORY_DOCS_SERVICE_ID}/`;

function matchStoryDocsServicePath(normalizedPath: string): string | undefined {
	if (normalizedPath.startsWith(STORY_DOCS_SERVICE_PREFIX) && normalizedPath.endsWith('.json')) {
		return normalizedPath.slice(STORY_DOCS_SERVICE_PREFIX.length, -'.json'.length);
	}
	return undefined;
}

/** Wraps one story-docs payload as `{ components: { [id]: payload } }`. */
async function buildStoryDocsServiceFile(id: string): Promise<string> {
	const storyDocsService = await getStoryDocsService();
	const payload = storyDocsService
		? await storyDocsService.queries.getStoryDocs.loaded({ id })
		: undefined;
	return JSON.stringify({ components: payload === undefined ? {} : { [id]: payload } });
}

async function resolveComponent(
	id: string,
	cls: IndexClassification,
): Promise<ResolvedEntry | undefined> {
	const [docgenService, storyDocsService, mdxService] = await Promise.all([
		getDocgenService(),
		getStoryDocsService(),
		getMdxService(),
	]);

	const [docgen, storyDocs] = await Promise.all([
		docgenService ? docgenService.queries.getDocgen.loaded({ id }) : undefined,
		storyDocsService ? storyDocsService.queries.getStoryDocs.loaded({ id }) : undefined,
	]);

	const attached = cls.attachedDocsByComponent.get(id) ?? [];
	let docs: Record<string, CoreMdxDoc> | undefined;
	if (attached.length > 0 && mdxService) {
		const mdxPayload = await mdxService.queries.getMdxForComponent.loaded({ id });
		if (mdxPayload?.docs) {
			docs = {};
			for (const entry of attached) {
				const doc = mdxPayload.docs[entry.id];
				if (doc) {
					docs[entry.id] = doc as CoreMdxDoc;
				}
			}
		}
	}

	const core: CoreDocgenComponent = {
		...docgen,
		id,
		name: docgen?.name ?? id,
		...(storyDocs?.stories ? { stories: storyDocs.stories } : {}),
		...(storyDocs?.import ? { import: storyDocs.import } : {}),
		...(docs ? { docs } : {}),
	};

	return { kind: 'component', component: adaptCoreComponent(core) };
}

async function resolveStandaloneDoc(id: string): Promise<ResolvedEntry | undefined> {
	const mdxService = await getMdxService();
	const payload = mdxService
		? await mdxService.queries.getMdxForComponent.loaded({ id })
		: undefined;
	const doc = payload?.docs?.[id];
	if (!doc) {
		return undefined;
	}
	return { kind: 'doc', doc: adaptCoreDoc(doc as CoreMdxDoc) as Doc };
}

/**
 * Builds the in-process manifest provider and single-entry resolver for
 * docgen-server mode. The closures read the live story index and services on each
 * call (both internally cached), so they stay in lock-step with HMR.
 */
export function createDocgenServerManifestAccess(options: Options): DocgenServerManifestAccess {
	const manifestProvider: ManifestProvider = async (_request, path) => {
		const normalized = path.replace(/^\.?\//, '');

		if (normalized === 'manifests/components.json') {
			const cls = classifyIndex(await getStoryIndex(options));
			return buildComponentsManifest(cls);
		}

		if (normalized === 'manifests/docs.json') {
			const cls = classifyIndex(await getStoryIndex(options));
			const docs = await buildDocsManifest(cls);
			if (docs === undefined) {
				throw new Error('No unattached docs manifest available');
			}
			return docs;
		}

		const storyDocsId = matchStoryDocsServicePath(normalized);
		if (storyDocsId) {
			return buildStoryDocsServiceFile(storyDocsId);
		}

		throw new Error(`Unsupported in-process manifest path: ${path}`);
	};

	const resolveEntry: ResolveEntry = async (id) => {
		const cls = classifyIndex(await getStoryIndex(options));

		if (cls.unattachedDocs.has(id)) {
			return resolveStandaloneDoc(id);
		}
		if (cls.componentIds.includes(id)) {
			return resolveComponent(id, cls);
		}
		return undefined;
	};

	return { manifestProvider, resolveEntry };
}
