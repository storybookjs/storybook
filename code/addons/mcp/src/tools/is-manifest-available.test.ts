import { describe, it, expect, vi } from 'vitest';
import { isManifestAvailable } from './is-manifest-available.ts';
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

describe('isManifestAvailable', () => {
	it.each([
		{
			description: 'both feature flag and generator are present',
			options: { featureFlag: true, hasGenerator: true },
			expected: true,
		},
		{
			description: 'feature flag is disabled',
			options: { featureFlag: false, hasGenerator: true },
			expected: false,
		},
		{
			description: 'generator is not configured',
			options: { featureFlag: true, hasGenerator: false },
			expected: false,
		},
		{
			description: 'both are missing',
			options: { featureFlag: false, hasGenerator: false },
			expected: false,
		},
		{
			description: 'features object is missing the flag',
			options: { hasGenerator: true, hasFeaturesObject: false },
			expected: false,
		},
	])(
		'should return $expected when $description',
		async ({ options, expected }) => {
			const mockOptions = createMockOptions(options);
			const result = await isManifestAvailable(mockOptions);

			if (expected) {
				expect(result).toBeTruthy();
			} else {
				expect(result).toBeFalsy();
			}
		},
	);
});
