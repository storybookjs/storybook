import type { Options } from 'storybook/internal/types';

export const isManifestAvailable = async (
	options: Options,
): Promise<boolean> => {
	const [features, componentManifestGenerator] = await Promise.all([
		options.presets.apply('features') as any,
		options.presets.apply('experimental_componentManifestGenerator'),
	]);
	return features.experimentalComponentsManifest && componentManifestGenerator;
};
