import { describe, it, expect, vi } from 'vitest';
import { getReviewStatus } from './is-review-available.ts';
import type { Options } from 'storybook/internal/types';

function createMockOptions({
	changeDetection = false,
	addons = [] as Array<string | { name: string; options?: unknown }>,
	hasFeaturesObject = true,
}: {
	changeDetection?: boolean;
	addons?: Array<string | { name: string; options?: unknown }>;
	hasFeaturesObject?: boolean;
} = {}): Options {
	return {
		presets: {
			apply: vi.fn(async (key: string) => {
				if (key === 'features') {
					return hasFeaturesObject ? { changeDetection } : {};
				}
				if (key === 'addons') {
					return addons;
				}
				return undefined;
			}),
		},
	} as unknown as Options;
}

describe('getReviewStatus', () => {
	it.each([
		{
			description: 'both feature flag and addon are present (string entry)',
			options: { changeDetection: true, addons: ['@storybook/addon-review'] },
			expected: { available: true, hasFeatureFlag: true, hasAddon: true },
		},
		{
			description: 'both feature flag and addon are present (object entry)',
			options: { changeDetection: true, addons: [{ name: '@storybook/addon-review' }] },
			expected: { available: true, hasFeatureFlag: true, hasAddon: true },
		},
		{
			description: 'missing addon (unsupported config)',
			options: { changeDetection: true, addons: [] },
			expected: { available: false, hasFeatureFlag: true, hasAddon: false },
		},
		{
			description: 'missing feature flag',
			options: { changeDetection: false, addons: ['@storybook/addon-review'] },
			expected: { available: false, hasFeatureFlag: false, hasAddon: true },
		},
		{
			description: 'both are missing',
			options: { changeDetection: false, addons: [] },
			expected: { available: false, hasFeatureFlag: false, hasAddon: false },
		},
		{
			description: 'features object is missing the flag',
			options: { addons: ['@storybook/addon-review'], hasFeaturesObject: false },
			expected: { available: false, hasFeatureFlag: false, hasAddon: true },
		},
		{
			description: 'unrelated addons are ignored',
			options: {
				changeDetection: true,
				addons: ['@storybook/addon-docs', { name: '@storybook/addon-a11y' }],
			},
			expected: { available: false, hasFeatureFlag: true, hasAddon: false },
		},
	])('returns the correct status when $description', async ({ options, expected }) => {
		const mockOptions = createMockOptions(options);
		const result = await getReviewStatus(mockOptions);
		expect(result).toEqual(expected);
	});
});
