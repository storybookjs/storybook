import { describe, it, expect, vi } from 'vitest';
import { getManifestStatus } from './is-manifest-available.ts';
import type { Options } from 'storybook/internal/types';

function createMockOptions({
	featureFlag = false,
	hasGenerator = false,
	hasFeaturesObject = true,
}: {
	featureFlag?: boolean;
	hasGenerator?: boolean;
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
				if (key === 'experimental_componentManifestGenerator') {
					return hasGenerator ? vi.fn() : undefined;
				}
				return undefined;
			}),
		},
	} as unknown as Options;
}

describe('getManifestStatus', () => {
	it.each([
		{
			description: 'both feature flag and generator are present',
			options: { featureFlag: true, hasGenerator: true },
			expected: { available: true, hasGenerator: true, hasFeatureFlag: true },
		},
		{
			description: 'missing generator (unsupported framework)',
			options: { featureFlag: true, hasGenerator: false },
			expected: { available: false, hasGenerator: false, hasFeatureFlag: true },
		},
		{
			description: 'missing feature flag',
			options: { featureFlag: false, hasGenerator: true },
			expected: { available: false, hasGenerator: true, hasFeatureFlag: false },
		},
		{
			description: 'both are missing',
			options: { featureFlag: false, hasGenerator: false },
			expected: {
				available: false,
				hasGenerator: false,
				hasFeatureFlag: false,
			},
		},
		{
			description: 'features object is missing the flag',
			options: { hasGenerator: true, hasFeaturesObject: false },
			expected: { available: false, hasGenerator: true, hasFeatureFlag: false },
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
