import type { ProjectType, SupportedLanguage } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import type { Feature } from 'storybook/internal/types';

import type { DependencyCollector } from '../dependency-collector';
import { generatorRegistry } from '../generators/GeneratorRegistry';
import { baseGenerator } from '../generators/baseGenerator';
import type { CommandOptions, GeneratorModule, GeneratorOptions } from '../generators/types';
import { AddonService } from '../services';
import type { FrameworkDetectionResult } from './FrameworkDetectionCommand';

export type GeneratorExecutionResult = (
  | ReturnType<typeof baseGenerator>
  | {
      shouldRunDev?: boolean;
      configDir?: string;
      storybookCommand?: string;
    }
) & { extraAddons: string[] };

type ExecuteProjectGeneratorOptions = {
  projectType: ProjectType;
  packageManager: JsPackageManager;
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
    private readonly addonService = new AddonService()
  ) {}

  async execute({
    projectType,
    options,
    packageManager,
    frameworkInfo,
    selectedFeatures,
  }: ExecuteProjectGeneratorOptions) {
    // Get and execute generator (supports both old and new style)
    const generatorResult = await this.executeProjectGenerator({
      projectType,
      packageManager,
      frameworkInfo,
      options,
      selectedFeatures,
    });

    // Determine Storybook command

    return {
      ...generatorResult,
      configDir: 'configDir' in generatorResult ? generatorResult.configDir : undefined,
      storybookCommand:
        generatorResult.storybookCommand ?? packageManager.getRunCommand('storybook'),
    };
  }

  /** Execute the project-specific generator */
  private readonly executeProjectGenerator = async ({
    projectType,
    packageManager,
    frameworkInfo,
    options,
    selectedFeatures,
  }: ExecuteProjectGeneratorOptions) => {
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
      yes: options.yes,
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
      features: selectedFeatures,
      dependencyCollector: this.dependencyCollector,
    } as GeneratorOptions;

    if (frameworkOptions.skipGenerator) {
      return {
        shouldRunDev: frameworkOptions.shouldRunDev,
        storybookCommand: frameworkOptions.storybookCommand,
        extraAddons: [],
      };
    }

    const extraAddons = this.addonService.getAddonsForFeatures(selectedFeatures);

    // Call baseGenerator with complete configuration
    const generatorResult = await baseGenerator(packageManager, npmOptions, generatorOptions, {
      ...frameworkOptions,
      extraAddons: [...(frameworkOptions.extraAddons ?? []), ...extraAddons],
    });

    return {
      ...generatorResult,
      extraAddons,
    };
  };
}

export const executeGeneratorExecution = (
  options: ExecuteProjectGeneratorOptions & { dependencyCollector: DependencyCollector }
) => {
  return new GeneratorExecutionCommand(options.dependencyCollector).execute(options);
};
