import type { StorybookConfigRaw, StorybookFeatures } from 'storybook/internal/types';
import { SupportedRenderer } from 'storybook/internal/types';

import semver from 'semver';

import {
  getFrameworkPackageName,
  getRendererName,
  updateMainConfig,
} from '../helpers/mainConfigFile.ts';
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
  async ({
    mainConfigPath,
    mainConfig,
    beforeVersion,
    storybookVersion,
    requested,
  }: CheckOptions) => {
    if (!mainConfigPath) {
      return null;
    }
    // The flag does not exist before 10.5, so writing it into an older project's main config would
    // only confuse it. This floor holds even when the user asked for the fix by name.
    const current = semver.coerce(storybookVersion);
    if (!current || semver.lt(current, MIN_VERSION)) {
      return null;
    }
    // These flags are opt-in, so they are only ever surfaced on the upgrade that introduces them.
    // Naming the fix (`automigrate <fixId>` or `upgrade --features <flag>`) is itself the opt-in
    // and skips the boundary, which is what makes `--features` work on a project already on 10.5.
    if (!requested && !(beforeVersion && crossesFeatureBoundary(beforeVersion, storybookVersion))) {
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

/**
 * Whether the project resolves an `experimental_docgenProvider`. Every React framework inherits one
 * from the React renderer preset, while Vue and Angular ship theirs at the framework level, so
 * their non-Vite siblings (nuxt, vue3-rsbuild, `@storybook/angular`) have none. Without a provider
 * the flag only strips the docgen-derived `inferArgTypes`/`inferControls` enhancers and serves
 * nothing in their place.
 */
const hasDocgenProvider = (mainConfig: StorybookConfigRaw): boolean =>
  getRendererName(mainConfig) === SupportedRenderer.REACT ||
  ['@storybook/vue3-vite', '@storybook/angular-vite'].includes(
    getFrameworkPackageName(mainConfig) ?? ''
  );

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

const checkDocgenServer = checkFeature('experimentalDocgenServer');

export const enableExperimentalDocgenServer: Fix = {
  id: 'enable-experimental-docgen-server',
  link: 'https://storybook.js.org/docs/api/main-config/main-config-features#experimentaldocgenserver',
  defaultSelected: false,
  check: async (options) =>
    hasDocgenProvider(options.mainConfig) ? checkDocgenServer(options) : null,
  prompt: () =>
    'Enable experimentalDocgenServer for faster startup and more accurate Controls/ArgTypes in React projects.',
  run: enableFeature('experimentalDocgenServer'),
};

/** Feature-flag names accepted by `storybook upgrade --features`, mapped to the fix that sets them. */
const FEATURE_FLAG_FIXES = {
  experimentalReview: enableExperimentalReview,
  experimentalDocgenServer: enableExperimentalDocgenServer,
} satisfies Partial<Record<keyof StorybookFeatures, Fix>>;

/**
 * Maps a `--features experimentalReview,...` value onto the fixes that enable those flags. Throws
 * on any name that is not a supported flag, so both the CLI arg parser and the upgrade run fail
 * loudly rather than silently ignoring a typo.
 */
export const resolveRequestedFeatures = (
  features: string | undefined
): Array<{ name: string; fixId: string }> => {
  const names =
    features
      ?.split(',')
      .map((name) => name.trim())
      .filter(Boolean) ?? [];

  const unknown = names.filter((name) => !(name in FEATURE_FLAG_FIXES));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown feature flag(s): ${unknown.join(', ')}. Available: ${Object.keys(FEATURE_FLAG_FIXES).join(', ')}.`
    );
  }

  return names.map((name) => ({
    name,
    fixId: FEATURE_FLAG_FIXES[name as keyof typeof FEATURE_FLAG_FIXES].id,
  }));
};
