import type { StorybookConfigRaw, StorybookFeatures } from 'storybook/internal/types';
import { SupportedRenderer } from 'storybook/internal/types';

import {
  getFrameworkPackageName,
  getRendererName,
  updateMainConfig,
} from '../helpers/mainConfigFile.ts';
import { crossesVersionBoundary, isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

const hasDocgenProvider = (mainConfig: StorybookConfigRaw): boolean =>
  getRendererName(mainConfig) === SupportedRenderer.REACT ||
  ['@storybook/vue3-vite', '@storybook/angular-vite'].includes(
    getFrameworkPackageName(mainConfig) ?? ''
  );

export interface ExperimentalFeatureFixOptions {
  id: string;
  /** The `features` key this fix sets to `true`. */
  name: keyof StorybookFeatures;
  /** Storybook version that added this flag. Each flag carries its own, per release. */
  introducedIn: string;
  link: string;
  /** Keep it to one line, like every other automigration prompt. */
  prompt: string;
  /** A feature this flag builds on; the flag is inert when that one is explicitly disabled. */
  requires?: keyof StorybookFeatures;
  /** Extra applicability check, e.g. the project must ship a docgen provider. */
  isSupported?: (mainConfig: StorybookConfigRaw) => boolean;
}

export const createExperimentalFeatureFix = ({
  id,
  name,
  introducedIn,
  link,
  prompt,
  requires,
  isSupported,
}: ExperimentalFeatureFixOptions): Fix => ({
  id,
  link,
  defaultSelected: false,
  prompt: () => prompt,

  async check({ mainConfigPath, mainConfig, beforeVersion, storybookVersion, requested }) {
    if (!mainConfigPath) {
      return null;
    }
    if (isSupported && !isSupported(mainConfig)) {
      return null;
    }
    if (!isAtOrPastVersion(storybookVersion, introducedIn)) {
      return null;
    }
    if (
      !requested &&
      !(beforeVersion && crossesVersionBoundary(beforeVersion, storybookVersion, introducedIn))
    ) {
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
  },

  run: async ({ mainConfigPath, dryRun }) => {
    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      main.setFieldValue(['features', name], true);
    });
  },
});

export const enableExperimentalReview = createExperimentalFeatureFix({
  id: 'enable-experimental-review',
  name: 'experimentalReview',
  introducedIn: '10.5.0',
  requires: 'changeDetection',
  link: 'https://storybook.js.org/docs/api/main-config/main-config-features#experimentalreview',
  prompt:
    'Enable experimentalReview to offer the agentic review workflow to all MCP clients, not just the storybook ai CLI.',
});

export const enableExperimentalDocgenServer = createExperimentalFeatureFix({
  id: 'enable-experimental-docgen-server',
  name: 'experimentalDocgenServer',
  introducedIn: '10.5.0',
  isSupported: hasDocgenProvider,
  link: 'https://storybook.js.org/docs/api/main-config/main-config-features#experimentaldocgenserver',
  prompt: 'Enable experimentalDocgenServer for faster startup and more accurate Controls/ArgTypes.',
});

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
