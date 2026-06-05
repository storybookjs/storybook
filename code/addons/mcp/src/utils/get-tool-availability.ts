import type { Options } from 'storybook/internal/types';
import { isModuleGraphSupported } from './module-graph.ts';
import { getReviewStatus } from './is-review-available.ts';
import { getManifestStatus } from '../tools/is-manifest-available.ts';
import { getAddonVitestConstants } from '../tools/run-story-tests.ts';
import { isAddonA11yEnabled } from './is-addon-a11y-enabled.ts';

export interface ToolAvailability {
	/** Storybook ships the `core/module-graph` open service. Gates `get-stories-by-component`. */
	dependencyGraphSupported: boolean;
	/** The `changeDetection` feature flag is enabled. Gates `get-changed-stories`. */
	changeDetectionEnabled: boolean;
	/** `changeDetection` flag + `@storybook/addon-review` are both present. Gates `display-review`. */
	reviewEnabled: boolean;
	/** Component-manifest feature is on AND manifests were found. Gates the `docs` toolset. */
	docsEnabled: boolean;
	/** Any component manifests were found (drives the docs "why disabled" copy). */
	docsHasManifests: boolean;
	/** The component-manifest feature flag is enabled (drives the docs "why disabled" copy). */
	docsFeatureEnabled: boolean;
	/** `@storybook/addon-vitest` is installed. Gates the `test` toolset (`run-story-tests`). */
	testSupported: boolean;
	/** `@storybook/addon-a11y` is enabled. Gates the accessibility sub-feature of `run-story-tests`. */
	a11yEnabled: boolean;
}

export interface GetToolAvailabilityOptions {
	/**
	 * Pre-resolved `features` preset. Pass it to avoid re-applying the preset and
	 * risking a different snapshot than the caller already resolved.
	 */
	features?: { changeDetection?: boolean } | undefined;
}

/**
 * Single source of truth for the runtime gates that decide whether each tool is
 * registered (and how the landing page badges it).
 *
 * Every dynamic gate lives here — the dependency graph, the change-detection
 * pipeline, review, the component manifest (docs), addon-vitest (test) and the
 * accessibility sub-feature — so the MCP server (which registers the tools) and
 * the browser landing page (which shows enabled/disabled badges) can never drift
 * apart. Add new gates here rather than computing them ad-hoc at a call site.
 */
export async function getToolAvailability(
	options: Options,
	{ features }: GetToolAvailabilityOptions = {},
): Promise<ToolAvailability> {
	const resolvedFeatures =
		features ??
		((await options.presets.apply('features', {})) as { changeDetection?: boolean } | undefined);

	const [
		dependencyGraphSupported,
		reviewStatus,
		manifestStatus,
		addonVitestConstants,
		a11yEnabled,
	] = await Promise.all([
		isModuleGraphSupported(),
		getReviewStatus(options, { features: resolvedFeatures }),
		getManifestStatus(options),
		getAddonVitestConstants(),
		isAddonA11yEnabled(options),
	]);

	return {
		dependencyGraphSupported,
		changeDetectionEnabled: resolvedFeatures?.changeDetection ?? false,
		reviewEnabled: reviewStatus.available,
		docsEnabled: manifestStatus.available,
		docsHasManifests: manifestStatus.hasManifests,
		docsFeatureEnabled: manifestStatus.hasFeatureFlag,
		testSupported: !!addonVitestConstants,
		a11yEnabled,
	};
}
