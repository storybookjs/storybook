import { describe, it, expect, vi } from 'vitest';
import { getManifestStatus } from './is-manifest-available.ts';
import type { Options } from 'storybook/internal/types';

function createMockOptions({
	featureFlag = false,
	featureFlagName = 'componentsManifest' as 'componentsManifest' | 'experimentalComponentsManifest',
	hasManifests = false,
	hasLegacyComponentManifestGenerator = false,
	hasFeaturesObject = true,
}: {
	featureFlag?: boolean;
	featureFlagName?: 'componentsManifest' | 'experimentalComponentsManifest';
	hasManifests?: boolean;
	hasLegacyComponentManifestGenerator?: boolean;
	hasFeaturesObject?: boolean;
} = {}): Options {
	return {
		presets: {
			apply: vi.fn(async (key: string) => {
				if (key === 'features') {
					return hasFeaturesObject ? { [featureFlagName]: featureFlag } : {};
				}
				if (key === 'experimental_manifests') {
					return hasManifests ? { components: { v: 1, components: {} } } : undefined;
				}
				if (key === 'experimental_componentManifestGenerator') {
					return hasLegacyComponentManifestGenerator ? vi.fn() : undefined;
				}
				return undefined;
			}),
		},
	} as unknown as Options;
}

describe('getManifestStatus', () => {
	it.each([
		{
			description: 'both feature flag and manifests are present',
			options: { featureFlag: true, hasManifests: true },
			expected: { available: true, hasManifests: true, hasFeatureFlag: true },
		},
		{
			description: 'both feature flag and legacy component manifest generator are present',
			options: { featureFlag: true, hasLegacyComponentManifestGenerator: true },
			expected: { available: true, hasManifests: true, hasFeatureFlag: true },
		},
		{
			description: 'missing manifests (unsupported framework)',
			options: { featureFlag: true, hasManifests: false },
			expected: { available: false, hasManifests: false, hasFeatureFlag: true },
		},
		{
			description: 'missing feature flag',
			options: { featureFlag: false, hasManifests: true },
			expected: { available: false, hasManifests: true, hasFeatureFlag: false },
		},
		{
			description: 'both are missing',
			options: { featureFlag: false, hasManifests: false },
			expected: {
				available: false,
				hasManifests: false,
				hasFeatureFlag: false,
			},
		},
		{
			description: 'features object is missing the flag',
			options: { hasManifests: true, hasFeaturesObject: false },
			expected: { available: false, hasManifests: true, hasFeatureFlag: false },
		},
		{
			description: 'legacy experimentalComponentsManifest flag is true (backwards compat)',
			options: {
				featureFlag: true,
				featureFlagName: 'experimentalComponentsManifest' as const,
				hasManifests: true,
			},
			expected: { available: true, hasManifests: true, hasFeatureFlag: true },
		},
		{
			description: 'legacy experimentalComponentsManifest flag is false (backwards compat)',
			options: {
				featureFlag: false,
				featureFlagName: 'experimentalComponentsManifest' as const,
				hasManifests: true,
			},
			expected: { available: false, hasManifests: true, hasFeatureFlag: false },
		},
	])('should return correct status when $description', async ({ options, expected }) => {
		const mockOptions = createMockOptions(options);
		const result = await getManifestStatus(mockOptions);
		expect(result).toEqual(expected);
	});

	it('should correctly detect no manifests when components are not present in experimental_manifests', async () => {
		// the `manifests` preset can be present but without manifests.components, because `addon-docs` sets manifests.docs
		const result = await getManifestStatus({
			presets: {
				apply: vi.fn(async (key: string) => {
					if (key === 'features') {
						return { componentsManifest: true };
					}
					if (key === 'experimental_manifests') {
						// addon-docs has set manifests.docs, but there are no actual component manifests
						return { docs: { v: 1, docs: {} } };
					}
					return undefined;
				}),
			},
		} as unknown as Options);
		expect(result).toEqual({
			available: false,
			hasManifests: false,
			hasFeatureFlag: true,
		});
	});
});
