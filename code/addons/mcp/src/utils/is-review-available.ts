import { getAddonNames, loadMainConfig } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

const REVIEW_ADDON_NAME = '@storybook/addon-review';

export type ReviewStatus = {
	available: boolean;
	hasFeatureFlag: boolean;
	hasAddon: boolean;
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

	// Read the user's `main.ts` addons array and detect @storybook/addon-review presence
	let hasAddon = false;
	try {
		const mainConfig = await loadMainConfig({ configDir: options.configDir });
		hasAddon = getAddonNames(mainConfig).includes(REVIEW_ADDON_NAME);
	} catch {
		hasAddon = false;
	}

	return {
		available: hasFeatureFlag && hasAddon,
		hasFeatureFlag,
		hasAddon,
	};
};
