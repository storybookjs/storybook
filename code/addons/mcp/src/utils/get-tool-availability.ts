import type { Options } from 'storybook/internal/types';
import { isDependencyGraphSupported } from './change-detection.ts';
import { getReviewStatus, type ReviewStatus } from './is-review-available.ts';

export interface ToolAvailability {
	/**
	 * Storybook ships the dependency-graph API (the dev-server builder supports it).
	 * Gates `get-stories-by-component`.
	 */
	dependencyGraphSupported: boolean;
	/**
	 * The change-detection status pipeline AND the dependency graph are both available.
	 * Gates `get-changed-stories`.
	 */
	changeDetectionEnabled: boolean;
	/** Full review status; `.available` gates `display-review`. */
	reviewStatus: ReviewStatus;
}

export interface GetToolAvailabilityOptions {
	/**
	 * Pre-resolved `features` preset. Pass it to avoid re-applying the preset and
	 * risking a different snapshot than the caller already resolved.
	 */
	features?: { changeDetection?: boolean } | undefined;
}

/**
 * Single source of truth for the runtime gates that decide whether the
 * change-detection and review tools are registered.
 *
 * Used both by the MCP server (to actually register the tools) and by the
 * browser landing page (to show accurate enabled/disabled badges), so the two
 * can never drift apart.
 */
export async function getToolAvailability(
	options: Options,
	{ features }: GetToolAvailabilityOptions = {},
): Promise<ToolAvailability> {
	const resolvedFeatures =
		features ??
		((await options.presets.apply('features', {})) as { changeDetection?: boolean } | undefined);
	// The dependency graph and the change-detection status pipeline are independent in Storybook:
	// the graph runs whenever the dev-server has a supporting builder; `features.changeDetection`
	// only gates the status pipeline that powers `get-changed-stories`.
	const dependencyGraphSupported = await isDependencyGraphSupported();
	const changeDetectionEnabled =
		(resolvedFeatures?.changeDetection ?? false) && dependencyGraphSupported;
	const reviewStatus = await getReviewStatus(options, { features: resolvedFeatures });

	return { dependencyGraphSupported, changeDetectionEnabled, reviewStatus };
}
