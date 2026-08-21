import type { StorybookFeatures } from 'storybook/internal/types';

import semver from 'semver';

import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { CheckOptions, Fix } from '../types.ts';

const MIN_VERSION = '10.5.0';

/**
 * Whether this upgrade crosses the 10.5 boundary within the same major.
 *
 * Prereleases are coerced away so that upgrading to `10.5.0-rc.1` counts as reaching 10.5; without
 * that, an RC user would be skipped here and then skipped again on the stable release, because by
 * then their before-version is already past the boundary.
 */
const crossesFeatureBoundary = (beforeVersion: string, targetVersion: string): boolean => {
  const before = semver.coerce(beforeVersion);
  const target = semver.coerce(targetVersion);
  if (!before || !target) {
    return false;
  }
  return (
    semver.lt(before, MIN_VERSION) &&
    semver.gte(target, MIN_VERSION) &&
    before.major === target.major
  );
};

const checkFeature =
  (name: keyof StorybookFeatures, requires?: keyof StorybookFeatures) =>
  async ({ mainConfigPath, mainConfig, beforeVersion, storybookVersion }: CheckOptions) => {
    if (!mainConfigPath) {
      return null;
    }
    // Outside an upgrade (`storybook automigrate`, or an explicit `--features` request) there is
    // no boundary to cross, so only real applicability below decides.
    if (beforeVersion && !crossesFeatureBoundary(beforeVersion, storybookVersion)) {
      return null;
    }
    // Leave an explicit choice alone, in either direction.
    if (mainConfig.features?.[name] !== undefined) {
      return null;
    }
    // The flag would be inert without the feature it builds on.
    if (requires && mainConfig.features?.[requires] === false) {
      return null;
    }
    return {};
  };

const enableFeature = (name: keyof StorybookFeatures) =>
  async function run({ mainConfigPath, dryRun }: { mainConfigPath: string; dryRun?: boolean }) {
    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      main.setFieldValue(['features', name], true);
    });
  };

export const enableExperimentalReview: Fix = {
  id: 'enable-experimental-review',
  link: 'https://storybook.js.org/docs/api/main-config/main-config-features#experimentalreview',
  defaultSelected: false,
  check: checkFeature('experimentalReview', 'changeDetection'),
  prompt: () =>
    'Enable experimentalReview to offer the agentic review workflow to all MCP clients, not just the storybook ai CLI.',
  run: enableFeature('experimentalReview'),
};

export const enableExperimentalDocgenServer: Fix = {
  id: 'enable-experimental-docgen-server',
  link: 'https://storybook.js.org/docs/api/main-config/main-config-features#experimentaldocgenserver',
  defaultSelected: false,
  check: checkFeature('experimentalDocgenServer'),
  prompt: () =>
    'Enable experimentalDocgenServer for faster startup and more accurate Controls/ArgTypes in React projects.',
  run: enableFeature('experimentalDocgenServer'),
};

/** Feature-flag names accepted by `storybook upgrade --features`, mapped to the fix that sets them. */
export const FEATURE_FLAG_FIXES = {
  experimentalReview: enableExperimentalReview,
  experimentalDocgenServer: enableExperimentalDocgenServer,
} satisfies Partial<Record<keyof StorybookFeatures, Fix>>;
