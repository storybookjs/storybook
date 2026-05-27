import { getAddonNames, loadMainConfig } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

const REVIEW_ADDON_NAME = '@storybook/addon-review';

export type ReviewStatus = {
	available: boolean;
	hasFeatureFlag: boolean;
	hasAddon: boolean;
};

export const getReviewStatus = async (options: Options): Promise<ReviewStatus> => {
	const features = (await options.presets.apply('features', {})) as
		| { changeDetection?: boolean }
		| undefined;
	const hasFeatureFlag = !!features?.changeDetection;

	// Read the user's `main.ts` addons array directly via Storybook's public
	// helpers. `getAddonNames` normalizes each entry (strips `/preset`,
	// `/manager`, `node_modules/`, file extensions, etc.) so we get the
	// package name the user typed.
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
