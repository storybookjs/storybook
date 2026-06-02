/**
 * Shim around `experimental_getDependencyGraphService`. Older Storybook versions
 * don't ship it; we dynamically import and treat a missing export as "unsupported".
 */

export interface StoryDependencyGraphService {
	lookup(dep: string): Map<string, number>;
	hasGraph(): boolean;
}

type GetActiveServiceFn = () => StoryDependencyGraphService | undefined;

let probed: GetActiveServiceFn | null | undefined;

async function probe(): Promise<GetActiveServiceFn | null> {
	if (probed !== undefined) return probed;
	try {
		const mod = (await import('storybook/internal/core-server')) as Record<string, unknown>;
		const fn = mod.experimental_getDependencyGraphService;
		probed = typeof fn === 'function' ? (fn as GetActiveServiceFn) : null;
	} catch {
		probed = null;
	}
	return probed;
}

/** True iff the loaded Storybook ships the graph API. */
export async function isDependencyGraphSupported(): Promise<boolean> {
	return (await probe()) !== null;
}

/**
 * Returns the active graph, or undefined if Storybook doesn't ship the API, or the dev-server
 * hasn't started it yet. A non-undefined result doesn't mean the graph is built — call `hasGraph()`.
 */
export async function getDependencyGraphService(): Promise<
	StoryDependencyGraphService | undefined
> {
	const fn = await probe();
	return fn ? fn() : undefined;
}
