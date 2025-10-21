import { CoreBuilder, type ProjectType, detectBuilder } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import type { SupportedFrameworks, SupportedRenderers } from 'storybook/internal/types';

import { generatorRegistry } from '../generators/GeneratorRegistry';
import type { CommandOptions, GeneratorModule } from '../generators/types';

export interface FrameworkDetectionResult {
  framework: SupportedFrameworks | undefined;
  renderer: SupportedRenderers;
  builder: CoreBuilder;
  frameworkPackage: string;
  rendererPackage: string;
  builderPackage: string;
}

/**
 * Command for detecting framework, renderer, and builder from ProjectType
 *
 * Uses generator metadata to determine the correct framework and renderer, and detects or uses
 * overridden builder configuration.
 */
export class FrameworkDetectionCommand {
  /** Execute framework detection for the given project type */
  async execute(
    projectType: ProjectType,
    packageManager: JsPackageManager,
    options: CommandOptions
  ): Promise<FrameworkDetectionResult> {
    // Get generator for the project type
    const generatorModule = this.getGeneratorModule(projectType);

    if (!generatorModule) {
      throw new Error(`No generator found for project type: ${projectType}`);
    }

    const { metadata } = generatorModule;

    // Determine builder - use override if specified, otherwise detect
    let builder: CoreBuilder;
    if (options.builder) {
      // CLI option takes precedence
      builder = options.builder as CoreBuilder;
    } else if (metadata.builderOverride) {
      if (typeof metadata.builderOverride === 'function') {
        builder = metadata.builderOverride();
      } else {
        builder = metadata.builderOverride;
      }
    } else {
      // Detect builder from project configuration
      builder = await detectBuilder(packageManager);
    }

    // Get framework and renderer from metadata
    const framework = metadata.framework;
    const renderer = metadata.renderer;

    // Resolve package names
    const { frameworkPackage, rendererPackage, builderPackage } = this.resolvePackageNames(
      framework,
      renderer,
      builder
    );

    return {
      framework,
      renderer,
      builder,
      frameworkPackage,
      rendererPackage,
      builderPackage,
    };
  }

  /** Get generator module from registry */
  private getGeneratorModule(projectType: ProjectType): GeneratorModule | undefined {
    const generator = generatorRegistry.get(projectType);

    // Check if it's a new-style generator module
    if (generator && typeof generator === 'object' && 'metadata' in generator) {
      return generator as GeneratorModule;
    }

    // For backward compatibility, we still support old-style generators
    // but we can't extract metadata from them
    return undefined;
  }

  /** Resolve package names from framework/renderer/builder */
  private resolvePackageNames(
    framework: SupportedFrameworks | undefined,
    renderer: SupportedRenderers,
    builder: CoreBuilder
  ): {
    frameworkPackage: string;
    rendererPackage: string;
    builderPackage: string;
  } {
    // Construct framework package name
    // If framework is specified, use @storybook/{framework}
    // Otherwise, construct from renderer-builder (e.g., @storybook/react-vite)
    const storybookFramework = framework?.replace(/^@storybook\//, '');
    const storybookBuilder = this.getBuilderString(builder);

    const frameworkPackage = framework
      ? `@storybook/${storybookFramework}`
      : `@storybook/${renderer}-${storybookBuilder}`;

    const rendererPackage = `@storybook/${renderer}`;

    const builderPackage =
      builder === CoreBuilder.Vite ? '@storybook/builder-vite' : '@storybook/builder-webpack5';

    return {
      frameworkPackage,
      rendererPackage,
      builderPackage,
    };
  }

  /** Convert CoreBuilder enum to string for package name construction */
  private getBuilderString(builder: CoreBuilder): string {
    return builder === CoreBuilder.Vite ? 'vite' : 'webpack5';
  }
}

export const executeFrameworkDetection = (
  projectType: ProjectType,
  packageManager: JsPackageManager,
  options: CommandOptions
) => {
  return new FrameworkDetectionCommand().execute(projectType, packageManager, options);
};
