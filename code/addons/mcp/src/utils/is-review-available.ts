import type { Options } from 'storybook/internal/types';

const REVIEW_ADDON_NAME = '@storybook/addon-review';

export type ReviewStatus = {
	available: boolean;
	hasFeatureFlag: boolean;
	hasAddon: boolean;
};

export const getReviewStatus = async (options: Options): Promise<ReviewStatus> => {
	const [features, addons] = await Promise.all([
		options.presets.apply('features', {}) as any,
		options.presets.apply('addons', []) as any,
	]);

	const hasFeatureFlag = !!features?.changeDetection;
	const hasAddon =
		Array.isArray(addons) &&
		addons.some((addon: unknown) => {
			const name =
				typeof addon === 'string'
					? addon
					: addon && typeof addon === 'object' && 'name' in addon
						? (addon as { name: unknown }).name
						: undefined;
			return typeof name === 'string' && name.includes(REVIEW_ADDON_NAME);
		});

	return {
		available: hasFeatureFlag && hasAddon,
		hasFeatureFlag,
		hasAddon,
	};
};
