import { describe, it, expect, vi } from 'vitest';
import type { Options } from 'storybook/internal/types';

import { getReviewStatus } from './is-review-available.ts';

function createMockOptions({
  changeDetection = false,
  experimentalReview,
  hasFeaturesObject = true,
  configDir = '/project/.storybook',
}: {
  changeDetection?: boolean;
  experimentalReview?: boolean;
  hasFeaturesObject?: boolean;
  configDir?: string;
} = {}): Options {
  return {
    configDir,
    presets: {
      apply: vi.fn(async (key: string) => {
        if (key === 'features') {
          return hasFeaturesObject ? { changeDetection, experimentalReview } : {};
        }
        return undefined;
      }),
    },
  } as unknown as Options;
}

describe('getReviewStatus', () => {
  it('returns available when both experimentalReview and changeDetection are on', async () => {
    const result = await getReviewStatus(
      createMockOptions({ changeDetection: true, experimentalReview: true })
    );

    expect(result).toEqual({ available: true, availableForCli: true, hasFeatureFlag: true });
  });

  it('is unavailable to direct MCP clients but available to the CLI when only changeDetection is on', async () => {
    const result = await getReviewStatus(createMockOptions({ changeDetection: true }));

    expect(result).toEqual({ available: false, availableForCli: true, hasFeatureFlag: false });
  });

  it('is unavailable everywhere when experimentalReview is explicitly false', async () => {
    const result = await getReviewStatus(
      createMockOptions({ changeDetection: true, experimentalReview: false })
    );

    expect(result).toEqual({ available: false, availableForCli: false, hasFeatureFlag: false });
  });

  it('is unavailable when experimentalReview is on but changeDetection is off', async () => {
    const result = await getReviewStatus(createMockOptions({ experimentalReview: true }));

    expect(result).toEqual({ available: false, availableForCli: false, hasFeatureFlag: true });
  });

  it('returns hasFeatureFlag=false when features object is missing the flag', async () => {
    const result = await getReviewStatus(createMockOptions({ hasFeaturesObject: false }));

    expect(result).toEqual({ available: false, availableForCli: false, hasFeatureFlag: false });
  });

  it('uses pre-resolved features when provided and skips presets.apply', async () => {
    const mockOptions = createMockOptions({ changeDetection: false, experimentalReview: false });
    // Pass features explicitly with both flags on; the mock's `presets.apply`
    // would return them as off if asked, so an `available: true` result here
    // proves we used the provided value and didn't re-resolve.
    const result = await getReviewStatus(mockOptions, {
      features: { changeDetection: true, experimentalReview: true },
    });

    expect(result).toEqual({ available: true, availableForCli: true, hasFeatureFlag: true });
    expect(mockOptions.presets.apply).not.toHaveBeenCalledWith('features', expect.anything());
  });
});
