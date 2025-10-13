import type { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import type { DependencyCollector } from '../dependency-collector';
import { getAddonA11yDependencies } from '../addon-dependencies/addon-a11y';
import { getAddonVitestDependencies } from '../addon-dependencies/addon-vitest';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import type { CommandOptions, GeneratorFeature } from '../generators/types';
import { FeatureCompatibilityService, ONBOARDING_PROJECT_TYPES } from '../services/FeatureCompatibilityService';

export interface GeneratorExecutionResult {
  installResult: any;
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
  private featureService: FeatureCompatibilityService;

  constructor() {
    this.featureService = new FeatureCompatibilityService();
  }

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

    // Collect addon dependencies for test feature
    if (selectedFeatures.has('test')) {
      await this.collectAddonDependencies(projectType, packageManager, dependencyCollector);
    }

    // Get and execute generator
    const installResult = await this.executeProjectGenerator(
      projectType,
      packageManager,
      options,
      dependencyCollector
    );

    // Sync features back because they may have been mutated by the generator
    Object.assign(selectedFeatures, new Set(options.features));

    // Determine Storybook command
    const storybookCommand = this.getStorybookCommand(projectType, packageManager, installResult);

    return { installResult, storybookCommand };
  }

  /**
   * Filter features based on project type compatibility
   */
  private filterFeatures(projectType: ProjectType, selectedFeatures: Set<GeneratorFeature>): void {
    // Remove onboarding if not supported
    if (selectedFeatures.has('onboarding') && !ONBOARDING_PROJECT_TYPES.includes(projectType as any)) {
      selectedFeatures.delete('onboarding');
    }
  }

  /**
   * Collect addon dependencies without installing them
   */
  private async collectAddonDependencies(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    dependencyCollector: DependencyCollector
  ): Promise<void> {
    try {
      // Determine framework package name for Next.js detection
      const frameworkPackageName =
        projectType === 'NEXTJS' ? '@storybook/nextjs' : undefined;

      const vitestDeps = await getAddonVitestDependencies(packageManager, frameworkPackageName);
      const a11yDeps = getAddonA11yDependencies();

      dependencyCollector.addDevDependencies([...vitestDeps, ...a11yDeps]);
    } catch (err) {
      logger.warn(`Failed to collect addon dependencies: ${err}`);
    }
  }

  /**
   * Execute the project-specific generator
   */
  private async executeProjectGenerator(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    options: CommandOptions,
    dependencyCollector: DependencyCollector
  ): Promise<any> {
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

  /**
   * Get the appropriate Storybook command for the project type
   */
  private getStorybookCommand(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    installResult: any
  ): string {
    if (projectType === 'ANGULAR') {
      return `ng run ${installResult.projectName}:storybook`;
    }

    return packageManager.getRunCommand('storybook');
  }
}

