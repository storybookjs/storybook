import {
  ProjectType,
  detect,
  installableProjectTypes,
  isStorybookInstantiated,
} from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { HandledError } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import type { CommandOptions } from '../generators/types';

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
  /** Execute project type detection */
  async execute(packageManager: JsPackageManager, options: CommandOptions): Promise<ProjectType> {
    let projectType: ProjectType;
    const projectTypeProvided = options.type;

    if (projectTypeProvided) {
    }

    // Use provided type or auto-detect
    if (projectTypeProvided) {
      projectType = await this.validateProvidedType(projectTypeProvided);
      logger.step(`Installing Storybook for user specified project type: ${projectTypeProvided}`);
    } else {
      projectType = await this.autoDetectProjectType(packageManager, options);
      logger.debug(`Project type detected: ${projectType}`);
    }

    // Check for existing installation
    await this.checkExistingInstallation(projectType, options);

    return projectType;
  }

  /** Validate user-provided project type */
  private async validateProvidedType(projectTypeProvided: string): Promise<ProjectType> {
    if (installableProjectTypes.includes(projectTypeProvided)) {
      return projectTypeProvided.toUpperCase() as ProjectType;
    }

    logger.error(
      `The provided project type ${projectTypeProvided} was not recognized by Storybook`
    );

    throw new HandledError(`Unknown project type supplied: ${projectTypeProvided}`);
  }

  /** Auto-detect project type */
  private async autoDetectProjectType(
    packageManager: JsPackageManager,
    options: CommandOptions
  ): Promise<ProjectType> {
    try {
      const detectedType = (await detect(packageManager as any, options)) as ProjectType;

      // Handle React Native special case
      if (detectedType === ProjectType.REACT_NATIVE && !options.yes) {
        return await this.promptReactNativeVariant();
      }

      if (detectedType === ProjectType.UNDETECTED) {
        logger.error('Storybook failed to detect your project type');
        throw new HandledError('Storybook failed to detect your project type');
      }

      return detectedType;
    } catch (err) {
      logger.error(String(err));
      throw new HandledError(err);
    }
  }

  /** Prompt user to select React Native variant */
  // TODO: Extract into generator
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
  private async checkExistingInstallation(
    projectType: ProjectType,
    options: CommandOptions
  ): Promise<void> {
    const storybookInstantiated = isStorybookInstantiated();

    if (options.force === false && storybookInstantiated && projectType !== ProjectType.ANGULAR) {
      const force = await prompt.confirm({
        message:
          'We found a .storybook config directory in your project. Therefore we assume that Storybook is already instantiated for your project. Do you still want to continue and force the initialization?',
      });

      if (force) {
        options.force = true;
      } else {
        process.exit(0);
      }
    }
  }
}

export const executeProjectDetection = (
  packageManager: JsPackageManager,
  options: CommandOptions
) => {
  return new ProjectDetectionCommand().execute(packageManager, options);
};
