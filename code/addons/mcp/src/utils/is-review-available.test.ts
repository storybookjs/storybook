import { describe, it, expect, vi } from 'vitest';
import type { Options } from 'storybook/internal/types';

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
	it('returns available when change detection is on', async () => {
		const result = await getReviewStatus(createMockOptions({ changeDetection: true }));

		expect(result).toEqual({ available: true, hasFeatureFlag: true });
	});

	it('returns hasFeatureFlag=false when changeDetection is disabled', async () => {
		const result = await getReviewStatus(createMockOptions({ changeDetection: false }));

		expect(result).toEqual({ available: false, hasFeatureFlag: false });
	});

	it('returns hasFeatureFlag=false when features object is missing the flag', async () => {
		const result = await getReviewStatus(createMockOptions({ hasFeaturesObject: false }));

		expect(result).toEqual({ available: false, hasFeatureFlag: false });
	});

	it('uses pre-resolved features when provided and skips presets.apply', async () => {
		const mockOptions = createMockOptions({ changeDetection: false });
		// Pass features explicitly with changeDetection=true; the mock's
		// `presets.apply` would return changeDetection=false if asked, so a
		// `true` result here proves we used the provided value and didn't
		// re-resolve.
		const result = await getReviewStatus(mockOptions, {
			features: { changeDetection: true },
		});

		expect(result).toEqual({ available: true, hasFeatureFlag: true });
		expect(mockOptions.presets.apply).not.toHaveBeenCalledWith('features', expect.anything());
	});
});
