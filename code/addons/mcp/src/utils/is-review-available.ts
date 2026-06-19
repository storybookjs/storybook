import type { Options } from 'storybook/internal/types';

export type ReviewStatus = {
	available: boolean;
	hasFeatureFlag: boolean;
};

export interface GetReviewStatusOptions {
	features?: { changeDetection?: boolean } | undefined;
}

export const getReviewStatus = async (
	options: Options,
	{ features }: GetReviewStatusOptions = {},
): Promise<ReviewStatus> => {
	const resolvedFeatures =
		features ??
		((await options.presets.apply('features', {})) as { changeDetection?: boolean } | undefined);
	const hasFeatureFlag = !!resolvedFeatures?.changeDetection;

	return {
		available: hasFeatureFlag,
		hasFeatureFlag,
	};
};
