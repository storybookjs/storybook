import type { StorybookFeatures } from 'storybook/internal/types';

import { crossesVersionBoundary, isAtOrPastVersion } from '../helpers/versionBoundary.ts';
import type { Fix } from '../types.ts';

interface ExperimentalFeatureFixOptions {
  id: string;
  name: keyof StorybookFeatures;
  introducedIn: string;
  link: string;
  prompt: string;
}

export const createExperimentalFeatureFix = ({
  id,
  name,
  introducedIn,
  link,
  prompt,
}: ExperimentalFeatureFixOptions): Fix => ({
  id,
  link,
  defaultSelected: false,
  prompt: () => prompt,

  async check({ mainConfig, beforeVersion, storybookVersion, requested }) {
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
    return {};
  },

  transform: () => [
    { filter: { kind: ['main'] }, editConfig: (main) => main.set(['features', name], true) },
  ],
});

const FEATURE_FLAG_FIXES: Partial<Record<keyof StorybookFeatures, Fix>> = {};

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
      `Unknown feature flag(s): ${unknown.join(', ')}. Available: ${Object.keys(FEATURE_FLAG_FIXES).join(', ') || 'none'}.`
    );
  }

  return names.map((name) => ({
    name,
    fixId: FEATURE_FLAG_FIXES[name as keyof StorybookFeatures]!.id,
  }));
};
