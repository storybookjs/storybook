import type { Options } from 'storybook/internal/types';

export type ManifestStatus = {
	available: boolean;
	hasManifests: boolean;
	hasFeatureFlag: boolean;
};

export const getManifestStatus = async (
	options: Options,
): Promise<ManifestStatus> => {
	const [features, manifests] = await Promise.all([
		options.presets.apply('features') as any,
		options.presets.apply('experimental_manifests', undefined, {
			manifestEntries: [],
		}),
	]);

	const hasManifests = !!manifests;
	const hasFeatureFlag = !!features?.experimentalComponentsManifest;

	return {
		available: hasFeatureFlag && hasManifests,
		hasManifests,
		hasFeatureFlag,
	};
};
