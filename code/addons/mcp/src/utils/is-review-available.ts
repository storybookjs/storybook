import type { Options } from 'storybook/internal/types';

export type ReviewStatus = {
	available: boolean;
	/**
	 * Review gate for the `storybook ai` CLI channel (the Claude/Codex plugins):
	 * on by default, `experimentalReview: false` is the explicit opt-out.
	 */
	availableForCli: boolean;
	hasFeatureFlag: boolean;
};

export interface GetReviewStatusOptions {
	features?: { changeDetection?: boolean; experimentalReview?: boolean } | undefined;
}

export const getReviewStatus = async (
	options: Options,
	{ features }: GetReviewStatusOptions = {},
): Promise<ReviewStatus> => {
	const resolvedFeatures =
		features ??
		((await options.presets.apply('features', {})) as
			| { changeDetection?: boolean; experimentalReview?: boolean }
			| undefined);
	const hasFeatureFlag = !!resolvedFeatures?.experimentalReview;
	const changeDetection = !!resolvedFeatures?.changeDetection;

	return {
		// Review is opt-in via `experimentalReview` for direct MCP clients and
		// builds on the change-detection pipeline, so it needs both flags.
		available: hasFeatureFlag && changeDetection,
		availableForCli: resolvedFeatures?.experimentalReview !== false && changeDetection,
		hasFeatureFlag,
	};
};
