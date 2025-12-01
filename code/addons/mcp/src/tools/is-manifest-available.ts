import type { Options } from 'storybook/internal/types';

export type ManifestStatus = {
	available: boolean;
	hasGenerator: boolean;
	hasFeatureFlag: boolean;
};

export const getManifestStatus = async (
	options: Options,
): Promise<ManifestStatus> => {
	const [features, componentManifestGenerator] = await Promise.all([
		options.presets.apply('features') as any,
		options.presets.apply('experimental_componentManifestGenerator'),
	]);

	const hasGenerator = !!componentManifestGenerator;
	const hasFeatureFlag = !!features?.experimentalComponentsManifest;

	return {
		available: hasFeatureFlag && hasGenerator,
		hasGenerator,
		hasFeatureFlag,
	};
};
