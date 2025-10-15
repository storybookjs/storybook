import type { Builder, ProjectType } from 'storybook/internal/cli';
import { AddonVitestService } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';

import type { GeneratorFeature } from '../generators/types';

/** Project types that support the onboarding feature */
export const ONBOARDING_PROJECT_TYPES = [
  'REACT',
  'REACT_SCRIPTS',
  'REACT_NATIVE_WEB',
  'REACT_PROJECT',
  'WEBPACK_REACT',
  'NEXTJS',
  'VUE3',
  'ANGULAR',
] as const;

/** Project types that support the test addon feature */
export const TEST_SUPPORTED_PROJECT_TYPES = [
  'REACT',
  'VUE3',
  'NEXTJS',
  'NUXT',
  'PREACT',
  'SVELTE',
  'SVELTEKIT',
  'WEB_COMPONENTS',
  'REACT_NATIVE_WEB',
] as const;

export interface FeatureCompatibilityResult {
  compatible: boolean;
  reasons?: string[];
}

/** Service for validating feature compatibility with project configurations */
export class FeatureCompatibilityService {
  /** Check if a project type supports onboarding */
  supportsOnboarding(projectType: ProjectType): boolean {
    return ONBOARDING_PROJECT_TYPES.includes(projectType as any);
  }

  /** Check if a project type and builder combination supports test addon */
  supportsTestAddon(projectType: ProjectType, builder: Builder): boolean {
    // Next.js always supports test addon
    if (projectType === 'NEXTJS') {
      return true;
    }

    // Webpack5 builder doesn't support test addon for other frameworks
    if (builder === 'webpack5') {
      return false;
    }

    // Check if project type is in the supported list
    return TEST_SUPPORTED_PROJECT_TYPES.includes(projectType as any);
  }

  /** Filter features based on project type and builder compatibility */
  filterFeaturesByProjectType(
    features: Set<GeneratorFeature>,
    projectType: ProjectType,
    builder: Builder
  ): Set<GeneratorFeature> {
    const filtered = new Set(features);

    // Remove onboarding if not supported
    if (filtered.has('onboarding') && !this.supportsOnboarding(projectType)) {
      filtered.delete('onboarding');
    }

    // Remove test if not supported
    if (filtered.has('test') && !this.supportsTestAddon(projectType, builder)) {
      filtered.delete('test');
    }

    return filtered;
  }

  /**
   * Validate all compatibility checks for test feature Returns true if all checks pass, false
   * otherwise
   */
  async validateTestFeatureCompatibility(
    packageManager: JsPackageManager,
    directory: string
  ): Promise<FeatureCompatibilityResult> {
    const addonVitestService = new AddonVitestService();

    // Check package versions using AddonVitestService
    const packageVersionsResult = await addonVitestService.validatePackageVersions(packageManager);
    if (!packageVersionsResult.compatible) {
      return packageVersionsResult;
    }

    // Check vitest config files using AddonVitestService
    const vitestConfigResult = await addonVitestService.validateConfigFiles(directory);
    if (!vitestConfigResult.compatible) {
      return vitestConfigResult;
    }

    return { compatible: true };
  }
}
