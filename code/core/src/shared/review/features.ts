import type { StorybookFeatures } from '../../types/modules/core-common.ts';

/**
 * Whether the agentic review feature is enabled. Review is opt-in via the
 * `experimentalReview` feature flag and builds on the change-detection pipeline, so it needs both
 * flags. Mirrors the availability check MCP tooling uses to register review tools.
 */
export const isReviewFeatureEnabled = (features: StorybookFeatures | undefined): boolean =>
  !!features?.experimentalReview && !!features?.changeDetection;
