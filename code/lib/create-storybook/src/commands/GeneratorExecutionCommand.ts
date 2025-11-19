import type { ProjectType } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import { type Feature, type SupportedLanguage } from 'storybook/internal/types';

import type { DependencyCollector } from '../dependency-collector';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import { baseGenerator } from '../generators/baseGenerator';
import type { CommandOptions, GeneratorModule, GeneratorOptions } from '../generators/types';
import { AddonService } from '../services';
import type { FrameworkDetectionResult } from './FrameworkDetectionCommand';

type ExecuteProjectGeneratorOptions = {
  projectType: ProjectType;
  language: SupportedLanguage;
  frameworkInfo: FrameworkDetectionResult;
  options: CommandOptions;
  selectedFeatures: Set<Feature>;
};

/**
 * Command for executing the project-specific generator
 *
 * Responsibilities:
 *
 * - Get generator module from registry
 * - Call generator's configure() to get framework-specific options
 * - Execute baseGenerator with complete configuration
 * - Determine Storybook command
 */
export class GeneratorExecutionCommand {
  /** Execute generator for the detected project type */
  constructor(
    private readonly dependencyCollector: DependencyCollector,
    private readonly jsPackageManager: JsPackageManager,
    private readonly addonService = new AddonService()
  ) {}

  async execute({
    projectType,
    options,
    frameworkInfo,
    selectedFeatures,
    language,
  }: ExecuteProjectGeneratorOptions) {
    // Get and execute generator (supports both old and new style)
    const generatorResult = await this.executeProjectGenerator({
      projectType,
      frameworkInfo,
      options,
      selectedFeatures,
      language,
    });

    // Determine Storybook command

    return {
      ...generatorResult,
      configDir: 'configDir' in generatorResult ? generatorResult.configDir : undefined,
      storybookCommand:
        generatorResult.storybookCommand !== undefined
          ? generatorResult.storybookCommand
          : this.jsPackageManager.getRunCommand('storybook'),
    };
  }

  /** Execute the project-specific generator */
  private readonly executeProjectGenerator = async ({
    projectType,
    frameworkInfo,
    options,
    selectedFeatures,
    language,
  }: ExecuteProjectGeneratorOptions) => {
    const generator = generatorRegistry.get(projectType);

    if (!generator) {
      throw new Error(`No generator found for project type: ${projectType}`);
    }

    const npmOptions = {
      type: 'devDependencies' as const,
      skipInstall: options.skipInstall,
    };

    // All generators must be new-style modules with metadata + configure
    const generatorModule = generator as GeneratorModule;

    // Call configure function to get framework-specific options
    const frameworkOptions = await generatorModule.configure(this.jsPackageManager, {
      framework: frameworkInfo.framework,
      renderer: frameworkInfo.renderer,
      builder: frameworkInfo.builder,
      language,
      linkable: !!options.linkable,
      features: selectedFeatures,
      dependencyCollector: this.dependencyCollector,
      yes: options.yes,
    });

    const generatorOptions = {
      language,
      builder: frameworkInfo.builder,
      framework: frameworkInfo.framework,
      renderer: frameworkInfo.renderer,
      linkable: !!options.linkable,
      pnp: !!options.usePnp,
      yes: !!options.yes,
      projectType,
      features: selectedFeatures,
      dependencyCollector: this.dependencyCollector,
    } as GeneratorOptions;

    if (frameworkOptions.skipGenerator) {
      if (generatorModule.postConfigure) {
        await generatorModule.postConfigure({ packageManager: this.jsPackageManager });
      }

      return {
        shouldRunDev: frameworkOptions.shouldRunDev,
        storybookCommand: frameworkOptions.storybookCommand,
        extraAddons: [],
      };
    }

    const extraAddons = this.addonService.getAddonsForFeatures(selectedFeatures);

    // Call baseGenerator with complete configuration
    const generatorResult = await baseGenerator(
      this.jsPackageManager,
      npmOptions,
      generatorOptions,
      {
        ...frameworkOptions,
        extraAddons: [...(frameworkOptions.extraAddons ?? []), ...extraAddons],
      }
    );

    if (generatorModule.postConfigure) {
      await generatorModule.postConfigure({ packageManager: this.jsPackageManager });
    }

    return {
      ...generatorResult,
      extraAddons,
    };
  };
}

export const executeGeneratorExecution = ({
  dependencyCollector,
  packageManager,
  ...options
}: ExecuteProjectGeneratorOptions & {
  dependencyCollector: DependencyCollector;
  packageManager: JsPackageManager;
}) => {
  return new GeneratorExecutionCommand(dependencyCollector, packageManager).execute(options);
};
