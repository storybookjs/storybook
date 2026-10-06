import type { StorybookFeatures } from '../../types/modules/core-common.ts';

// Review builds on the change-detection pipeline, so `changeDetection` is its only gate.
export const isReviewFeatureEnabled = (features: StorybookFeatures | undefined): boolean =>
  !!features?.changeDetection;
