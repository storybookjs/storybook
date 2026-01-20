import { describe, it, expect, vi } from 'vitest';
import { getManifestStatus } from './is-manifest-available.ts';
import type { Options } from 'storybook/internal/types';

function createMockOptions({
	featureFlag = false,
	hasManifests = false,
	hasLegacyComponentManifestGenerator = false,
	hasFeaturesObject = true,
}: {
	featureFlag?: boolean;
	hasManifests?: boolean;
	hasLegacyComponentManifestGenerator?: boolean;
	hasFeaturesObject?: boolean;
} = {}): Options {
	return {
		presets: {
			apply: vi.fn(async (key: string) => {
				if (key === 'features') {
					return hasFeaturesObject
						? { experimentalComponentsManifest: featureFlag }
						: {};
				}
				if (key === 'experimental_manifests') {
					return hasManifests
						? { components: { v: 1, components: {} } }
						: undefined;
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
			description:
				'both feature flag and legacy component manifest generator are present',
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
	])(
		'should return correct status when $description',
		async ({ options, expected }) => {
			const mockOptions = createMockOptions(options);
			const result = await getManifestStatus(mockOptions);
			expect(result).toEqual(expected);
		},
	);
});
