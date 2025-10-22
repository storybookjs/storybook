import { type ProjectType, detectBuilder } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import type { SupportedBuilder, SupportedRenderer } from 'storybook/internal/types';
import { SupportedFramework } from 'storybook/internal/types';

import { generatorRegistry } from '../generators/GeneratorRegistry';
import type { CommandOptions } from '../generators/types';

export interface FrameworkDetectionResult {
  renderer: SupportedRenderer;
  builder: SupportedBuilder;
  framework?: SupportedFramework;
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
    const generatorModule = generatorRegistry.get(projectType);

    if (!generatorModule) {
      throw new Error(`No generator found for project type: ${projectType}`);
    }

    const { metadata } = generatorModule;

    // Determine builder - use override if specified, otherwise detect
    let builder: SupportedBuilder;
    if (options.builder) {
      // CLI option takes precedence
      builder = options.builder as SupportedBuilder;
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
    const renderer = metadata.renderer;

    const framework = metadata.framework ?? this.getFramework(renderer, builder);

    return {
      framework,
      renderer,
      builder,
    };
  }

  private getFramework(
    renderer: SupportedRenderer,
    builder: SupportedBuilder
  ): SupportedFramework | undefined {
    // map renderer to framework
    // if successful, return the framework
    // if not successful, merge renderer and builder to get the framework
    // if renderer is one of the SupportedFramework enum
    if (Object.values(SupportedFramework).includes(renderer as any)) {
      return renderer as any as SupportedFramework;
    }

    const maybeFramework = `${renderer}-${builder}`;

    if (Object.values(SupportedFramework).includes(maybeFramework as SupportedFramework)) {
      return maybeFramework as SupportedFramework;
    }

    return undefined;
  }
}

export const executeFrameworkDetection = (
  projectType: ProjectType,
  packageManager: JsPackageManager,
  options: CommandOptions
) => {
  return new FrameworkDetectionCommand().execute(projectType, packageManager, options);
};
