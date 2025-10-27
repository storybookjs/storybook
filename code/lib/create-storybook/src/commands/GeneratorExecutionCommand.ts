import type { ProjectType, SupportedLanguage } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';

import type { DependencyCollector } from '../dependency-collector';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import { baseGenerator } from '../generators/baseGenerator';
import type { CommandOptions, GeneratorFeature, GeneratorModule } from '../generators/types';
import { FeatureCompatibilityService } from '../services/FeatureCompatibilityService';
import type { FrameworkDetectionResult } from './FrameworkDetectionCommand';

export type GeneratorExecutionResult =
  | ReturnType<typeof baseGenerator>
  | { shouldRunDev?: boolean; configDir?: string; storybookCommand?: string };

/**
 * Command for executing the project-specific generator
 *
 * Responsibilities:
 *
 * - Filter features based on project type compatibility
 * - Get generator module from registry
 * - Call generator's configure() to get framework-specific options
 * - Execute baseGenerator with complete configuration
 * - Determine Storybook command
 */
export class GeneratorExecutionCommand {
  /** Execute generator for the detected project type */
  async execute(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    frameworkInfo: FrameworkDetectionResult,
    options: CommandOptions,
    selectedFeatures: Set<GeneratorFeature>,
    dependencyCollector: DependencyCollector
  ): Promise<GeneratorExecutionResult> {
    // Filter onboarding feature based on project type support
    this.filterFeatures(projectType, selectedFeatures);

    // Update options with final selected features
    options.features = Array.from(selectedFeatures);

    // Get and execute generator (supports both old and new style)
    const generatorResult = await this.executeProjectGenerator(
      projectType,
      packageManager,
      frameworkInfo,
      options,
      dependencyCollector
    );

    // Determine Storybook command

    return {
      ...generatorResult,
      storybookCommand:
        generatorResult.storybookCommand ?? packageManager.getRunCommand('storybook'),
    };
  }

  /** Filter features based on project type compatibility */
  private filterFeatures(projectType: ProjectType, selectedFeatures: Set<GeneratorFeature>): void {
    // Remove onboarding if not supported
    if (
      selectedFeatures.has('onboarding') &&
      !FeatureCompatibilityService.supportsOnboarding(projectType)
    ) {
      selectedFeatures.delete('onboarding');
    }
  }

  /** Execute the project-specific generator */
  private async executeProjectGenerator(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    frameworkInfo: FrameworkDetectionResult,
    options: CommandOptions,
    dependencyCollector: DependencyCollector
  ) {
    const generator = generatorRegistry.get(projectType);

    if (!generator) {
      throw new Error(`No generator found for project type: ${projectType}`);
    }

    const npmOptions = {
      type: 'devDependencies' as const,
      skipInstall: options.skipInstall,
    };

    const language: SupportedLanguage = options.language || ('typescript' as SupportedLanguage);

    // All generators must be new-style modules with metadata + configure
    const generatorModule = generator as GeneratorModule;

    // Call configure function to get framework-specific options
    const frameworkOptions = await generatorModule.configure(packageManager, {
      framework: frameworkInfo.framework,
      renderer: frameworkInfo.renderer,
      builder: frameworkInfo.builder,
      language,
      linkable: !!options.linkable,
      features: options.features || [],
    });

    const generatorOptions = {
      language,
      builder: frameworkInfo.builder,
      framework: frameworkInfo.framework,
      renderer: frameworkInfo.renderer,
      linkable: !!options.linkable,
      pnp: options.usePnp as boolean,
      yes: options.yes as boolean,
      projectType,
      features: options.features || [],
      dependencyCollector,
    };

    if (frameworkOptions.skipGenerator) {
      return {
        shouldRunDev: frameworkOptions.shouldRunDev,
        storybookCommand: frameworkOptions.storybookCommand,
      };
    }

    // Call baseGenerator with complete configuration
    return baseGenerator(packageManager, npmOptions, generatorOptions, frameworkOptions);
  }
}

export const executeGeneratorExecution = (
  projectType: ProjectType,
  packageManager: JsPackageManager,
  frameworkInfo: FrameworkDetectionResult,
  options: CommandOptions,
  selectedFeatures: Set<GeneratorFeature>,
  dependencyCollector: DependencyCollector
) => {
  return new GeneratorExecutionCommand().execute(
    projectType,
    packageManager,
    frameworkInfo,
    options,
    selectedFeatures,
    dependencyCollector
  );
};
