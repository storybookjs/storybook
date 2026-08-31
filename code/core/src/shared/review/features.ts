import type { StorybookFeatures } from '../../types/modules/core-common.ts';

/**
 * Whether the review infrastructure (server review channel + manager review layer) should be
 * active. `experimentalReview` is tri-state:
 *
 * - `undefined` (default): the infrastructure mounts but stays dormant until a review is pushed.
 *   MCP tooling (`@storybook/addon-mcp`) only offers review to the `storybook ai` CLI channel by
 *   default (gated as `experimentalReview !== false`), not to direct MCP clients.
 * - `false`: explicit user opt-out — nothing mounts and MCP tooling disables review everywhere.
 * - `true`: explicit opt-in — MCP tooling also offers review to direct MCP clients.
 *
 * The default features preset must therefore never set `experimentalReview` explicitly: in the
 * merged preset an explicit default would be indistinguishable from a user opt-out. Review builds
 * on the change-detection pipeline, so it also needs `changeDetection`.
 */
export const isReviewFeatureEnabled = (features: StorybookFeatures | undefined): boolean =>
  features?.experimentalReview !== false && !!features?.changeDetection;

/**
 * Whether review is available to direct MCP clients: the explicit `experimentalReview` opt-in.
 *
 * Contrast with {@link isReviewFeatureEnabled}: with the flag unset the review infrastructure
 * still mounts (the `storybook ai` CLI channel turns review on per request), but direct MCP
 * clients never see `review-create` — so tool descriptions and result prose must not advertise
 * it. Mirrors `getReviewStatus().available` in `@storybook/addon-mcp`.
 */
export const isReviewExplicitlyEnabled = (features: StorybookFeatures | undefined): boolean =>
  !!features?.experimentalReview && !!features?.changeDetection;
