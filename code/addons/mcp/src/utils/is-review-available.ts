import type { Options } from 'storybook/internal/types';

export type ReviewStatus = {
	available: boolean;
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

	return {
		// Review is opt-in via `experimentalReview` and builds on the
		// change-detection pipeline, so it needs both flags.
		available: hasFeatureFlag && !!resolvedFeatures?.changeDetection,
		hasFeatureFlag,
	};
};
