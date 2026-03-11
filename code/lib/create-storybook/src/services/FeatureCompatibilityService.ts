import { AddonVitestService, ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import type { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

/** Project types that support the onboarding feature */
const ONBOARDING_PROJECT_TYPES: ProjectType[] = [
  ProjectType.REACT,
  ProjectType.REACT_SCRIPTS,
  ProjectType.REACT_NATIVE_WEB,
  ProjectType.NEXTJS,
  ProjectType.VUE3,
  ProjectType.ANGULAR,
];

export interface FeatureCompatibilityResult {
  compatible: boolean;
  reasons?: string[];
}

/** Service for validating feature compatibility with project configurations */
export class FeatureCompatibilityService {
  constructor(
    readonly packageManager: JsPackageManager,
    private readonly addonVitestService = new AddonVitestService(packageManager)
  ) {}

  /** Check if a project type supports onboarding */

  static supportsOnboarding(projectType: ProjectType): boolean {
    return ONBOARDING_PROJECT_TYPES.includes(
      projectType as (typeof ONBOARDING_PROJECT_TYPES)[number]
    );
  }

  /**
   * Validate all compatibility checks for test feature
   *
   * @param packageManager - Package manager instance
   * @param framework - Detected framework (e.g., 'nextjs', 'react-vite')
   * @param builder - Detected builder (e.g. SupportedBuilder.Vite)
   * @param directory - Project root directory
   * @returns Compatibility result with reasons if incompatible
   */
  async validateTestFeatureCompatibility(
    framework: SupportedFramework | null | undefined,
    builder: SupportedBuilder,
    directory: string
  ): Promise<FeatureCompatibilityResult> {
    const compatibilityResult = await this.addonVitestService.validateCompatibility({
      framework,
      builder,
      projectRoot: directory,
    });

    if (!compatibilityResult.compatible) {
      return compatibilityResult;
    }

    return { compatible: true };
  }
}
