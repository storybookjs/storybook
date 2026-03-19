import { type ProjectType } from 'storybook/internal/cli';
import { type JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { SupportedBuilder } from 'storybook/internal/types';
import { type SupportedRenderer } from 'storybook/internal/types';
import type { SupportedFramework } from 'storybook/internal/types';

import { generatorRegistry } from '../generators/GeneratorRegistry';
import type { CommandOptions } from '../generators/types';
import { FrameworkDetectionService } from '../services/FrameworkDetectionService';

export interface FrameworkDetectionResult {
  renderer: SupportedRenderer;
  builder: SupportedBuilder;
  framework: SupportedFramework | null;
}

/**
 * Command for detecting framework, renderer, and builder from ProjectType
 *
 * Uses generator metadata to determine the correct framework and renderer, and detects or uses
 * overridden builder configuration.
 */
export class FrameworkDetectionCommand {
  constructor(
    packageManager: JsPackageManager,
    private frameworkDetectionService = new FrameworkDetectionService(packageManager)
  ) {}
  async execute(
    projectType: ProjectType,
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
        builder = await metadata.builderOverride();
      } else {
        builder = metadata.builderOverride;
      }
    } else {
      // Detect builder from project configuration
      builder = await this.frameworkDetectionService.detectBuilder();
    }

    // Get framework and renderer from metadata
    const renderer = metadata.renderer;

    // Handle dynamic framework selection based on builder
    let framework: SupportedFramework | null;
    if (metadata.framework !== undefined) {
      if (typeof metadata.framework === 'function') {
        framework = metadata.framework(builder);
      } else {
        framework = metadata.framework;
      }
    } else {
      framework = this.frameworkDetectionService.detectFramework(renderer, builder);
    }

    if (framework) {
      logger.step(`Framework detected: ${framework}`);
    }

    return {
      framework,
      renderer,
      builder,
    };
  }
}

export const executeFrameworkDetection = (
  projectType: ProjectType,
  packageManager: JsPackageManager,
  options: CommandOptions
) => {
  return new FrameworkDetectionCommand(packageManager).execute(projectType, options);
};
