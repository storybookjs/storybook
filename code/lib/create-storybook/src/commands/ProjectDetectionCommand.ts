import { ProjectType } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type { SupportedLanguage } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { CommandOptions } from '../generators/types';
import { ProjectTypeService } from '../services/ProjectTypeService';

/**
 * Command for detecting the project type during Storybook initialization
 *
 * Responsibilities:
 *
 * - Auto-detect project type or use user-provided type
 * - Handle React Native variant selection
 * - Check for existing Storybook installation
 * - Prompt for force install if needed
 */
export class ProjectDetectionCommand {
  constructor(
    private options: CommandOptions,
    jsPackageManager: JsPackageManager,
    private projectTypeService: ProjectTypeService = new ProjectTypeService(jsPackageManager)
  ) {}

  /** Execute project type detection */
  async execute(): Promise<{ projectType: ProjectType; language: SupportedLanguage }> {
    let projectType: ProjectType;
    const projectTypeProvided = this.options.type;

    // Use provided type or auto-detect
    if (projectTypeProvided) {
      projectType = await this.projectTypeService.validateProvidedType(projectTypeProvided);
      logger.step(`Installing Storybook for user specified project type: ${projectTypeProvided}`);
    } else {
      const detected = await this.projectTypeService.autoDetectProjectType(this.options);
      projectType = detected;
      if (detected === ProjectType.REACT_NATIVE && !this.options.yes) {
        projectType = await this.promptReactNativeVariant();
      }
      logger.debug(`Project type detected: ${projectType}`);
    }

    // Check for existing installation
    await this.checkExistingInstallation(projectType);

    const language = this.options.language || (await this.projectTypeService.detectLanguage());

    return { projectType, language };
  }

  /** Prompt user to select React Native variant */
  private async promptReactNativeVariant(): Promise<ProjectType> {
    const manualType = await prompt.select({
      message: "We've detected a React Native project. Install:",
      options: [
        {
          label: `${picocolors.bold('React Native')}: Storybook on your device/simulator`,
          value: ProjectType.REACT_NATIVE,
        },
        {
          label: `${picocolors.bold('React Native Web')}: Storybook on web for docs, test, and sharing`,
          value: ProjectType.REACT_NATIVE_WEB,
        },
        {
          label: `${picocolors.bold('Both')}: Add both native and web Storybooks`,
          value: ProjectType.REACT_NATIVE_AND_RNW,
        },
      ],
    });
    return manualType as ProjectType;
  }

  /** Check if Storybook is already installed and handle force option */
  private async checkExistingInstallation(projectType: ProjectType): Promise<void> {
    const storybookInstantiated = this.projectTypeService.isStorybookInstantiated();
    const options = this.options;
    if (
      options.force !== true &&
      options.yes !== true &&
      storybookInstantiated &&
      projectType !== ProjectType.ANGULAR
    ) {
      const force = await prompt.confirm({
        message: dedent`We found a .storybook config directory in your project.
We assume that Storybook is already instantiated for your project. Do you still want to continue and force the initialization?`,
      });
      if (force || options.yes) {
        options.force = true;
      } else {
        if (!options.disableTelemetry) {
          await telemetry(
            'exit',
            { eventType: 'init', reason: 'existing-installation' },
            { stripMetadata: true, immediate: true }
          );
        }
        process.exit(0);
      }
    }
  }
}

export const executeProjectDetection = (
  packageManager: JsPackageManager,
  options: CommandOptions
) => {
  return new ProjectDetectionCommand(options, packageManager).execute();
};
