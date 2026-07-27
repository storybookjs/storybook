/**
 * Access helper for Storybook's `core/module-graph` open service — the reverse index from source
 * files to the story files that (transitively) import them. Replaces the removed
 * `experimental_getDependencyGraphService` compatibility API.
 *
 * Older Storybook versions don't ship the open-service runtime; we dynamically import and treat a
 * missing `getService` export (or an unregistered service) as "unsupported".
 *
 * The generic open-service query type (`Query`) is imported from core. The
 * module-graph-specific data shapes below (`ModuleGraphStatus`, `ModuleGraphStoryHit`, etc.) are
 * baked into the service's runtime definition and aren't part of core's public type surface, so we
 * mirror them here; keep them in sync with `core/module-graph` if it changes.
 */

import { importModule } from 'storybook/internal/common';
import type { Query } from 'storybook/internal/core-server';
import type { Builder, CoreConfig, Options } from 'storybook/internal/types';

const MODULE_GRAPH_SERVICE_ID = 'core/module-graph';

/** Serializable error shape carried by the module-graph status (mirrors the service's `ErrorLike`). */
export interface ModuleGraphErrorLike {
	message: string;
	name?: string;
	stack?: string;
}

/** Lifecycle status of the module graph; mirrors the service's `status` query output. */
export type ModuleGraphStatus =
	| { value: 'booting' }
	| { value: 'ready' }
	| { value: 'error'; error: ModuleGraphErrorLike }
	| { value: 'unavailable'; reason: string; error?: ModuleGraphErrorLike };

/** One reverse-index hit: a story file (story-index-relative path) and its BFS import depth. */
export interface ModuleGraphStoryHit {
	/** Story-index-style relative path such as `./src/Button.stories.tsx`. */
	storyFile: string;
	/** Breadth-first-search depth: shortest number of import edges to the story file. */
	depth: number;
}

type ModuleGraphStatusQuery = Query<undefined, ModuleGraphStatus>;
type ModuleGraphStoriesForFilesQuery = Query<{ files: string[] }, ModuleGraphStoryHit[][]>;

/** The subset of the `core/module-graph` runtime service surface addon-mcp consumes. */
export interface ModuleGraphService {
	queries: {
		status: ModuleGraphStatusQuery;
		/** Positional: result `i` corresponds to input `files[i]`. */
		storiesForFiles: ModuleGraphStoriesForFilesQuery;
	};
}

type GetServiceFn = (serviceId: string) => unknown;

let probed: GetServiceFn | null | undefined;

async function probe(): Promise<GetServiceFn | null> {
	if (probed !== undefined) return probed;
	try {
		const mod = (await import('storybook/internal/core-server')) as Record<string, unknown>;
		const fn = mod.getService;
		probed = typeof fn === 'function' ? (fn as GetServiceFn) : null;
	} catch {
		probed = null;
	}
	return probed;
}

/**
 * True iff the `core/module-graph` service is actually resolvable — i.e. Storybook ships the
 * open-service runtime AND the service is registered in this process. Reflects registration rather
 * than mere runtime presence so tool gating/badging can't drift from {@link getModuleGraphService}
 * (a builder may ship the runtime but not register the service, e.g. without change detection).
 */
export async function isModuleGraphSupported(): Promise<boolean> {
	return (await getModuleGraphService()) !== undefined;
}

export async function isModuleGraphSupportedByBuilder(
	options: Pick<Options, 'presets'>,
): Promise<boolean> {
	const core = (await options.presets.apply('core', {})) as CoreConfig | undefined;
	const builder = core?.builder;
	const builderName = typeof builder === 'string' ? builder : builder?.name;
	if (!builderName) {
		return false;
	}

	try {
		const previewBuilder = (await importModule(builderName)) as Partial<Builder<unknown>>;
		return typeof previewBuilder.changeDetectionAdapter === 'function';
	} catch {
		return false;
	}
}

/**
 * Resolves the `core/module-graph` runtime service, or `undefined` when Storybook doesn't ship the
 * open-service API or the service isn't registered (e.g. a builder without change detection, or the
 * dev server isn't running). A non-undefined result doesn't mean the graph is built — await
 * `queries.status.loaded(undefined)` and check for the `ready` status.
 */
export async function getModuleGraphService(): Promise<ModuleGraphService | undefined> {
	const getService = await probe();
	if (!getService) return undefined;
	try {
		return getService(MODULE_GRAPH_SERVICE_ID) as ModuleGraphService | undefined;
	} catch {
		// `getService` throws when the service isn't registered in this process.
		return undefined;
	}
}
