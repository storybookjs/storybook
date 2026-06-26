/**
 * Guarded access to Storybook's open services from the dev server process.
 *
 * `getService` is reached through a dynamic import of `storybook/internal/core-server`
 * and only ever entered in `experimentalDocgenServer` mode; on older Storybook
 * versions (no such export) or when a service is not registered, every accessor
 * resolves to `undefined` so the addon cleanly falls back to the fetch-based path.
 */

import type {
	getService as getServiceFn,
	MdxPayload,
	MdxServiceContract,
} from 'storybook/internal/core-server';
import type { DocgenService, Query, StoryDocsService } from 'storybook/open-service';

import { DOCGEN_SERVICE_ID, MDX_SERVICE_ID, STORY_DOCS_SERVICE_ID } from './vendored.ts';

/**
 * MDX service handle from `@storybook/addon-docs`. Core exports the manifest-writer
 * slice via {@link MdxServiceContract}; addon-docs also registers `mdxForComponent`.
 */
type MdxService = {
	queries: MdxServiceContract['queries'] & {
		mdxForComponent: Query<{ id: string }, MdxPayload | undefined>;
	};
};

type GetService = typeof getServiceFn;

let cachedGetService: GetService | null | undefined;

/**
 * Resolves `getService` once via a dynamic import. Returns `undefined` on Storybook
 * versions that don't export it (so callers fall back to the fetch-based path).
 */
async function loadGetService(): Promise<GetService | undefined> {
	if (cachedGetService !== undefined) {
		return cachedGetService ?? undefined;
	}
	try {
		const mod: unknown = await import('storybook/internal/core-server');
		const getService = (mod as { getService?: GetService }).getService;
		cachedGetService = getService ?? null;
		return getService;
	} catch {
		cachedGetService = null;
		return undefined;
	}
}

async function getServiceSafely<T>(id: string): Promise<T | undefined> {
	const getService = await loadGetService();
	if (!getService) {
		return undefined;
	}
	try {
		return getService<T>(id);
	} catch {
		// Service not registered (e.g. addon-docs absent, or feature off).
		return undefined;
	}
}

export function getDocgenService(): Promise<DocgenService | undefined> {
	return getServiceSafely<DocgenService>(DOCGEN_SERVICE_ID);
}

export function getStoryDocsService(): Promise<StoryDocsService | undefined> {
	return getServiceSafely<StoryDocsService>(STORY_DOCS_SERVICE_ID);
}

export function getMdxService(): Promise<MdxService | undefined> {
	return getServiceSafely<MdxService>(MDX_SERVICE_ID);
}
