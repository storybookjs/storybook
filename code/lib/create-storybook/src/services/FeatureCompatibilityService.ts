import { AddonVitestService, type CoreBuilder, ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import type { SupportedFrameworks } from 'storybook/internal/types';

/** Project types that support the onboarding feature */
export const ONBOARDING_PROJECT_TYPES = [
  ProjectType.REACT,
  ProjectType.REACT_SCRIPTS,
  ProjectType.REACT_NATIVE_WEB,
  ProjectType.REACT_PROJECT,
  ProjectType.WEBPACK_REACT,
  ProjectType.NEXTJS,
  ProjectType.VUE3,
  ProjectType.ANGULAR,
] satisfies ProjectType[];

/** Project types that support the test addon feature */
export const TEST_SUPPORTED_PROJECT_TYPES = [
  ProjectType.REACT,
  ProjectType.VUE3,
  ProjectType.NEXTJS,
  ProjectType.NUXT,
  ProjectType.PREACT,
  ProjectType.SVELTE,
  ProjectType.SVELTEKIT,
  ProjectType.WEB_COMPONENTS,
  ProjectType.REACT_NATIVE_WEB,
] satisfies ProjectType[];

export interface FeatureCompatibilityResult {
  compatible: boolean;
  reasons?: string[];
}

/** Service for validating feature compatibility with project configurations */
export class FeatureCompatibilityService {
  /** Check if a project type supports onboarding */
  supportsOnboarding(projectType: ProjectType): boolean {
    return ONBOARDING_PROJECT_TYPES.includes(
      projectType as (typeof ONBOARDING_PROJECT_TYPES)[number]
    );
  }

  /**
   * Validate all compatibility checks for test feature
   *
   * @param packageManager - Package manager instance
   * @param framework - Detected framework (e.g., 'nextjs', 'react-vite')
   * @param builder - Detected builder (CoreBuilder.Vite or CoreBuilder.Webpack5)
   * @param directory - Project root directory
   * @returns Compatibility result with reasons if incompatible
   */
  async validateTestFeatureCompatibility(
    packageManager: JsPackageManager,
    framework: SupportedFrameworks | undefined,
    builder: CoreBuilder,
    directory: string
  ): Promise<FeatureCompatibilityResult> {
    const addonVitestService = new AddonVitestService();

    // If no specific framework, construct from renderer-builder combo
    // The AddonVitestService expects a SupportedFrameworks value
    const frameworkForValidation = framework || ('react-vite' as SupportedFrameworks);

    const compatibilityResult = await addonVitestService.validateCompatibility({
      packageManager,
      framework: frameworkForValidation,
      builderPackageName: builder,
      projectRoot: directory,
    });

    if (!compatibilityResult.compatible) {
      return compatibilityResult;
    }

    return { compatible: true };
  }
}
