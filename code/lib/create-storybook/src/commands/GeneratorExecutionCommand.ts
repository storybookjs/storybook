import type { ProjectType } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';

import type { DependencyCollector } from '../dependency-collector';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import type { CommandOptions, Generator, GeneratorFeature } from '../generators/types';
import { ONBOARDING_PROJECT_TYPES } from '../services/FeatureCompatibilityService';

export interface GeneratorExecutionResult {
  generatorResult: Awaited<ReturnType<Generator>>;
  storybookCommand: string;
}

/**
 * Command for executing the project-specific generator
 *
 * Responsibilities:
 *
 * - Filter features based on project type compatibility
 * - Get generator from registry
 * - Execute generator with dependency collector
 * - Collect addon dependencies (vitest, a11y)
 * - Determine Storybook command
 */
export class GeneratorExecutionCommand {
  /** Execute generator for the detected project type */
  async execute(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    options: CommandOptions,
    selectedFeatures: Set<GeneratorFeature>,
    dependencyCollector: DependencyCollector
  ): Promise<GeneratorExecutionResult> {
    // Filter onboarding feature based on project type support
    this.filterFeatures(projectType, selectedFeatures);

    // Update options with final selected features
    options.features = Array.from(selectedFeatures);

    // Get and execute generator
    const generatorResult = await this.executeProjectGenerator(
      projectType,
      packageManager,
      options,
      dependencyCollector
    );

    // Sync features back because they may have been mutated by the generator
    Object.assign(selectedFeatures, new Set(options.features));

    // Determine Storybook command
    const storybookCommand = this.getStorybookCommand(
      projectType,
      packageManager,
      generatorResult as any
    );

    return { generatorResult, storybookCommand };
  }

  /** Filter features based on project type compatibility */
  private filterFeatures(projectType: ProjectType, selectedFeatures: Set<GeneratorFeature>): void {
    // Remove onboarding if not supported
    if (
      selectedFeatures.has('onboarding') &&
      !ONBOARDING_PROJECT_TYPES.includes(projectType as any)
    ) {
      selectedFeatures.delete('onboarding');
    }
  }

  /** Execute the project-specific generator */
  private async executeProjectGenerator(
    projectType: ProjectType,
    packageManager: JsPackageManager,
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

    const generatorOptions = {
      language: options.language || 'typescript',
      builder: options.builder,
      linkable: !!options.linkable,
      pnp: options.usePnp as boolean,
      yes: options.yes as boolean,
      projectType,
      features: options.features || [],
      dependencyCollector,
    };

    return generator(packageManager, npmOptions, generatorOptions as any, options);
  }

  /** Get the appropriate Storybook command for the project type */
  private getStorybookCommand(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    installResult: Awaited<ReturnType<Generator<{ projectName: string }>>>
  ): string {
    if (projectType === 'ANGULAR') {
      return `ng run ${installResult.projectName}:storybook`;
    }

    return packageManager.getRunCommand('storybook');
  }
}

export const executeGeneratorExecution = (
  projectType: ProjectType,
  packageManager: JsPackageManager,
  options: CommandOptions,
  selectedFeatures: Set<GeneratorFeature>,
  dependencyCollector: DependencyCollector
) => {
  return new GeneratorExecutionCommand().execute(
    projectType,
    packageManager,
    options,
    selectedFeatures,
    dependencyCollector
  );
};
