import { describe, expect, it } from 'vitest';

import type { StorybookFeatures } from '../../types/modules/core-common.ts';
import { features as defaultFeaturesPreset } from '../../core-server/presets/common-preset.ts';
import { isReviewExplicitlyEnabled, isReviewFeatureEnabled } from './features.ts';

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

describe('isReviewExplicitlyEnabled', () => {
  // The flag-unset default is where the two gates differ, and prose gated on the wrong one
  // advertises `review-create` to MCP clients that cannot see it: the infrastructure gate is on
  // by default, the direct-client gate only on explicit opt-in.
  it('stays off when the flag is unset, unlike the infrastructure gate', () => {
    const defaults = { changeDetection: true };
    expect(isReviewFeatureEnabled(defaults)).toBe(true);
    expect(isReviewExplicitlyEnabled(defaults)).toBe(false);
  });

  it('is enabled only on explicit opt-in with change detection', () => {
    expect(isReviewExplicitlyEnabled({ changeDetection: true, experimentalReview: true })).toBe(
      true
    );
    expect(isReviewExplicitlyEnabled({ changeDetection: true, experimentalReview: false })).toBe(
      false
    );
    expect(isReviewExplicitlyEnabled({ experimentalReview: true })).toBe(false);
    expect(isReviewExplicitlyEnabled(undefined)).toBe(false);
  });
});
