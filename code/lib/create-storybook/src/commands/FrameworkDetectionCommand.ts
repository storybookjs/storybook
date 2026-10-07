import { ProjectType } from 'storybook/internal/cli';
import { HandledError, type JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { SupportedBuilder } from 'storybook/internal/types';
import { type SupportedRenderer } from 'storybook/internal/types';
import type { SupportedFramework } from 'storybook/internal/types';

import { generatorRegistry } from '../generators/GeneratorRegistry.ts';
import type { CommandOptions } from '../generators/types.ts';
import { FrameworkDetectionService } from '../services/FrameworkDetectionService.ts';
import { TelemetryService } from '../services/TelemetryService.ts';

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
    private packageManager: JsPackageManager,
    private frameworkDetectionService = new FrameworkDetectionService(packageManager),
    private telemetryService = new TelemetryService()
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
    const dependencies = this.packageManager.getAllDependencies();

    if (
      projectType === ProjectType.REACT &&
      !options.builder &&
      (dependencies['react-scripts'] || dependencies['@storybook/preset-create-react-app'])
    ) {
      logger.error(
        'Create React App support was removed in Storybook 11. Remove @storybook/preset-create-react-app if installed and migrate your Storybook configuration to Vite. Then run `storybook init --type react --builder vite`. To use another supported builder, pass `--type react --builder <builder>` explicitly. See https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#create-react-app-support-removed'
      );
      throw new HandledError('Create React App requires an explicit Storybook builder');
    }

    // Determine builder - use override if specified, otherwise detect
    let builder: SupportedBuilder;
    if (options.builder) {
      // CLI option takes precedence
      builder = options.builder as SupportedBuilder;
    } else if (metadata.builderOverride) {
      if (typeof metadata.builderOverride === 'function') {
        builder = await metadata.builderOverride({
          options,
          telemetryService: this.telemetryService,
        });
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
