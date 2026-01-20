import type { Options } from 'storybook/internal/types';

export type ManifestStatus = {
	available: boolean;
	hasManifests: boolean;
	hasFeatureFlag: boolean;
};

export const getManifestStatus = async (
	options: Options,
): Promise<ManifestStatus> => {
	const [
		features,
		manifests,
		// Added for backwards compatibility with Storybook versions prior to v10.2.0-alpha.10
		// Should be removed once support for Storybook version < 10.2.0 is dropped
		legacyComponentManifestGenerator,
	] = await Promise.all([
		options.presets.apply('features') as any,
		options.presets.apply('experimental_manifests', undefined, {
			manifestEntries: [],
		}),
		options.presets.apply('experimental_componentManifestGenerator'),
	]);

	const hasManifests = !!manifests || !!legacyComponentManifestGenerator;
	const hasFeatureFlag = !!features?.experimentalComponentsManifest;

	return {
		available: hasFeatureFlag && hasManifests,
		hasManifests,
		hasFeatureFlag,
	};
};
