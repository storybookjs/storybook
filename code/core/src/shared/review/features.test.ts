import { describe, expect, it } from 'vitest';

import type { Options, StorybookFeatures } from '../../types/modules/core-common.ts';
import { features as defaultFeaturesPreset } from '../../core-server/presets/common-preset.ts';
import { isReviewFeatureEnabled } from './features.ts';

describe('isReviewFeatureEnabled', () => {
  it('is enabled with the untouched default features preset', async () => {
    const defaults = (await (
      defaultFeaturesPreset as (
        existing: StorybookFeatures | undefined,
        options: Options
      ) => Promise<StorybookFeatures>
    )(undefined, {} as Options))!;

    expect(isReviewFeatureEnabled(defaults)).toBe(true);
  });

  it('follows changeDetection', () => {
    expect(isReviewFeatureEnabled({ changeDetection: true })).toBe(true);
    expect(isReviewFeatureEnabled({ changeDetection: false })).toBe(false);
    expect(isReviewFeatureEnabled({})).toBe(false);
    expect(isReviewFeatureEnabled(undefined)).toBe(false);
  });
});
