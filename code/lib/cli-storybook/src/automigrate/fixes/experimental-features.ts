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

const crossesFeatureBoundary = (beforeVersion: string, targetVersion: string): boolean => {
  const before = semver.coerce(beforeVersion);
  const target = semver.coerce(targetVersion);
  if (!before || !target) {
    return false;
  }
  return semver.lt(before, MIN_VERSION) && semver.gte(target, MIN_VERSION);
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
    const current = semver.coerce(storybookVersion);
    if (!current || semver.lt(current, MIN_VERSION)) {
      return null;
    }
    if (!requested && !(beforeVersion && crossesFeatureBoundary(beforeVersion, storybookVersion))) {
      return null;
    }
    // Leave an explicit choice alone, in either direction.
    if (mainConfig.features?.[name] !== undefined) {
      return null;
    }
    if (requires && mainConfig.features?.[requires] === false) {
      return null;
    }
    return {};
  };

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
    'Enable experimentalDocgenServer for faster startup and more accurate Controls/ArgTypes.',
  run: enableFeature('experimentalDocgenServer'),
};

/** Feature-flag names accepted by `storybook upgrade --features`, mapped to the fix that sets them. */
const FEATURE_FLAG_FIXES = {
  experimentalReview: enableExperimentalReview,
  experimentalDocgenServer: enableExperimentalDocgenServer,
} satisfies Partial<Record<keyof StorybookFeatures, Fix>>;

export const resolveRequestedFeatures = (
  features: string | undefined
): Array<{ name: string; fixId: string }> => {
  const names =
    features
      ?.split(',')
      .map((name) => name.trim())
      .filter(Boolean) ?? [];

  const unknown = names.filter((name) => !Object.hasOwn(FEATURE_FLAG_FIXES, name));
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
