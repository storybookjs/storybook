import { describe, expect, it } from 'vitest';

import { isReviewFeatureEnabled } from './features.ts';

describe('isReviewFeatureEnabled', () => {
  it('is enabled by default (dormant infrastructure) when changeDetection is on', () => {
    // `experimentalReview` unset must NOT read as an opt-out: MCP tooling gates the
    // `storybook ai` CLI channel on `experimentalReview !== false`, so the default features
    // preset leaves the flag unset and the infrastructure mounts dormant.
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
