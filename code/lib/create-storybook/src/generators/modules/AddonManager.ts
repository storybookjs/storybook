import { getPackageDetails } from 'storybook/internal/common';
import type { SupportedBuilder } from 'storybook/internal/types';

import type { GeneratorFeature } from '../types';

export interface AddonConfiguration {
  addonsForMain: Array<string | { name: string; [key: string]: any }>;
  addonPackages: string[];
}

/** Module for managing Storybook addons */
export class AddonManager {
  /** Determine webpack compiler addon if needed */
  getWebpackCompilerAddon(
    builder: SupportedBuilder,
    webpackCompiler?: ({ builder }: { builder: SupportedBuilder }) => 'babel' | 'swc' | undefined
  ): string | undefined {
    if (!webpackCompiler) {
      return undefined;
    }

    const compiler = webpackCompiler({ builder });
    return compiler ? `@storybook/addon-webpack5-compiler-${compiler}` : undefined;
  }

  /** Get addons based on selected features */
  getAddonsForFeatures(features: GeneratorFeature[], extraAddons: string[] = []): string[] {
    const addons = [...extraAddons];

    if (features.includes('test')) {
      addons.push('@chromatic-com/storybook');
      addons.push('@storybook/addon-vitest');
      addons.push('@storybook/addon-a11y');
    }

    if (features.includes('docs')) {
      addons.push('@storybook/addon-docs');
    }

    if (features.includes('onboarding')) {
      addons.push('@storybook/addon-onboarding');
    }

    return addons;
  }

  /** Strip version numbers from addon names */
  stripVersions(addons: string[]): string[] {
    return addons.map((addon) => getPackageDetails(addon)[0]);
  }

  /** Configure addons for the project */
  configureAddons(
    features: GeneratorFeature[],
    extraAddons: string[] = [],
    builder: SupportedBuilder,
    webpackCompiler?: ({ builder }: { builder: SupportedBuilder }) => 'babel' | 'swc' | undefined
  ): AddonConfiguration {
    const compiler = this.getWebpackCompilerAddon(builder, webpackCompiler);

    // Get feature-based addons
    const featureAddons = this.getAddonsForFeatures(features, extraAddons);

    // Addons added to main.js
    const addonsForMain = [
      ...(compiler ? [compiler] : []),
      ...this.stripVersions(featureAddons),
    ].filter(Boolean);

    // Packages added to package.json
    const addonPackages = [...(compiler ? [compiler] : []), ...featureAddons].filter(Boolean);

    return {
      addonsForMain,
      addonPackages,
    };
  }
}
