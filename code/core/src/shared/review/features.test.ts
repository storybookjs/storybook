import { describe, expect, it } from 'vitest';

import type { StorybookFeatures } from '../../types/modules/core-common.ts';
import { features as defaultFeaturesPreset } from '../../core-server/presets/common-preset.ts';
import { isReviewFeatureEnabled } from './features.ts';

describe('isReviewFeatureEnabled', () => {
  it('is enabled with the untouched default features preset', async () => {
    const defaults = (await (
      defaultFeaturesPreset as (existing?: StorybookFeatures) => Promise<StorybookFeatures>
    )(undefined))!;

    // `experimentalReview` unset must NOT read as an opt-out: MCP tooling gates the
    // `storybook ai` CLI channel on `experimentalReview !== false`, so the default features
    // preset must leave the flag unset (an explicit `false` default is indistinguishable
    // from a user opt-out in the merged preset) and the infrastructure mounts dormant.
    expect(defaults).not.toHaveProperty('experimentalReview');
    expect(isReviewFeatureEnabled(defaults)).toBe(true);
  });

  it('is enabled by default (dormant infrastructure) when changeDetection is on', () => {
    expect(isReviewFeatureEnabled({ changeDetection: true })).toBe(true);
  });

  it('respects an explicit user opt-out', () => {
    expect(isReviewFeatureEnabled({ changeDetection: true, experimentalReview: false })).toBe(
      false
    );
  });

  it('is enabled on explicit opt-in', () => {
    expect(isReviewFeatureEnabled({ changeDetection: true, experimentalReview: true })).toBe(true);
  });

  it('requires the change-detection pipeline', () => {
    expect(isReviewFeatureEnabled({ experimentalReview: true })).toBe(false);
    expect(isReviewFeatureEnabled({ changeDetection: false, experimentalReview: true })).toBe(
      false
    );
    expect(isReviewFeatureEnabled(undefined)).toBe(false);
  });
});
