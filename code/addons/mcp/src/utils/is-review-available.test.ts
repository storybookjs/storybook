import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Options } from 'storybook/internal/types';

const { mockLoadMainConfig, mockGetAddonNames } = vi.hoisted(() => ({
	mockLoadMainConfig: vi.fn(),
	mockGetAddonNames: vi.fn(),
}));

vi.mock('storybook/internal/common', () => ({
	loadMainConfig: (...args: unknown[]) => mockLoadMainConfig(...args),
	getAddonNames: (...args: unknown[]) => mockGetAddonNames(...args),
}));

import { getReviewStatus } from './is-review-available.ts';

function createMockOptions({
	changeDetection = false,
	hasFeaturesObject = true,
	configDir = '/project/.storybook',
}: {
	changeDetection?: boolean;
	hasFeaturesObject?: boolean;
	configDir?: string;
} = {}): Options {
	return {
		configDir,
		presets: {
			apply: vi.fn(async (key: string) => {
				if (key === 'features') {
					return hasFeaturesObject ? { changeDetection } : {};
				}
				return undefined;
			}),
		},
	} as unknown as Options;
}

describe('getReviewStatus', () => {
	beforeEach(() => {
		mockLoadMainConfig.mockReset();
		mockGetAddonNames.mockReset();
		mockLoadMainConfig.mockResolvedValue({ addons: [] });
		mockGetAddonNames.mockReturnValue([]);
	});

	it('returns available when change detection is on and addon-review is in main.ts', async () => {
		mockGetAddonNames.mockReturnValue(['@storybook/addon-docs', '@storybook/addon-review']);
		const result = await getReviewStatus(createMockOptions({ changeDetection: true }));

		expect(mockLoadMainConfig).toHaveBeenCalledWith({ configDir: '/project/.storybook' });
		expect(result).toEqual({ available: true, hasFeatureFlag: true, hasAddon: true });
	});

	it('returns hasAddon=false when addon-review is not in main.ts', async () => {
		mockGetAddonNames.mockReturnValue(['@storybook/addon-docs', '@storybook/addon-a11y']);
		const result = await getReviewStatus(createMockOptions({ changeDetection: true }));

		expect(result).toEqual({ available: false, hasFeatureFlag: true, hasAddon: false });
	});

	it('returns hasFeatureFlag=false when changeDetection is disabled', async () => {
		mockGetAddonNames.mockReturnValue(['@storybook/addon-review']);
		const result = await getReviewStatus(createMockOptions({ changeDetection: false }));

		expect(result).toEqual({ available: false, hasFeatureFlag: false, hasAddon: true });
	});

	it('returns hasFeatureFlag=false when features object is missing the flag', async () => {
		mockGetAddonNames.mockReturnValue(['@storybook/addon-review']);
		const result = await getReviewStatus(createMockOptions({ hasFeaturesObject: false }));

		expect(result).toEqual({ available: false, hasFeatureFlag: false, hasAddon: true });
	});

	it('treats a failure to load main.ts as "addon not present" rather than crashing', async () => {
		mockLoadMainConfig.mockRejectedValue(new Error('main.ts blew up'));
		const result = await getReviewStatus(createMockOptions({ changeDetection: true }));

		expect(result).toEqual({ available: false, hasFeatureFlag: true, hasAddon: false });
	});
});
