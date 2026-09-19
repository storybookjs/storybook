import { ProjectType } from 'storybook/internal/cli';
import { HandledError } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import { SupportedLanguage } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { CommandOptions } from '../generators/types.ts';
import { createPromptCancelOptions } from '../prompt-cancel.ts';
import { ProjectTypeService } from '../services/ProjectTypeService.ts';
import { TelemetryService } from '../services/TelemetryService.ts';

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
    private projectTypeService: ProjectTypeService = new ProjectTypeService(jsPackageManager),
    private telemetryService = new TelemetryService()
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
      if (detected === ProjectType.UNDETECTED) {
        projectType = await this.promptUndetectedProjectType();
      }
      if (projectType === ProjectType.REACT_NATIVE && !this.options.yes) {
        projectType = await this.promptReactNativeVariant();
      }
      logger.debug(`Project type detected: ${projectType}`);
    }

    // Check for existing installation
    await this.checkExistingInstallation(projectType);

    const language = this.options.language || (await this.detectAndReportLanguage());

    return { projectType, language };
  }

  /** Detect language and warn about incompatible packages */
  private async detectAndReportLanguage(): Promise<SupportedLanguage> {
    const language = await this.projectTypeService.detectLanguage();

    if (language === SupportedLanguage.JAVASCRIPT) {
      const incompatibleReasons = await this.projectTypeService.detectIncompatiblePackageVersions();
      if (incompatibleReasons.length > 0) {
        logger.warn(
          `Populating with JavaScript examples due to incompatible package versions:\n${incompatibleReasons.map((r) => `  - ${r}`).join('\n')}`
        );
      }
    }

    return language;
  }

  /**
   * Handle the case where no supported framework could be detected: educate about the `--type`
   * flag and, when interactive, offer to install the HTML framework, pick another framework, or
   * cancel. Non-interactive runs keep the previous fail-with-error behavior.
   */
  private async promptUndetectedProjectType(): Promise<ProjectType> {
    logger.error(dedent`
      Storybook couldn't detect a supported framework in this directory. Make sure you're inside your project's root folder and that its dependencies are installed. Vanilla Web Components projects cannot be automatically detected.

      To tell Storybook which framework to use, pass the ${picocolors.bold('--type')} flag, e.g. ${picocolors.bold('--type html')} for Web Components and vanilla HTML projects.
    `);

    if (!this.options.yes) {
      const choice = await prompt.select(
        {
          message: 'How would you like to proceed?',
          options: [
            {
              label: `Install the ${picocolors.bold('HTML')} framework (for Web Components and HTML projects)`,
              value: 'html',
            },
            { label: 'Choose a framework to install', value: 'select' },
            { label: 'Abort', value: 'cancel' },
          ],
        },
        createPromptCancelOptions(this.telemetryService, 'undetected-project-type')
      );

      if (choice === 'html') {
        return ProjectType.HTML;
      }

      if (choice === 'select') {
        const installable = Object.values(ProjectType).filter(
          (t) => !['undetected', 'unsupported', 'nx'].includes(String(t))
        );
        const manualType = await prompt.select(
          {
            message: 'Which framework would you like to install?',
            options: installable.map((t) => ({ label: String(t), value: t })),
          },
          createPromptCancelOptions(this.telemetryService, 'undetected-project-type-framework')
        );
        return manualType as ProjectType;
      }
    }

    throw new HandledError('Storybook failed to detect your project type');
  }

  /** Prompt user to select React Native variant */
  private async promptReactNativeVariant(): Promise<ProjectType> {
    const manualType = await prompt.select(
      {
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
      },
      createPromptCancelOptions(this.telemetryService, 'react-native-variant')
    );
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
      const force = await prompt.confirm(
        {
          message: dedent`We found a .storybook config directory in your project.
We assume that Storybook is already instantiated for your project. Do you still want to continue and force the initialization?`,
        },
        createPromptCancelOptions(this.telemetryService, 'force-on-existing-installation')
      );
      if (force || options.yes) {
        options.force = true;
      } else {
        await telemetry(
          'exit',
          { eventType: 'init', reason: 'existing-installation' },
          { stripMetadata: true, immediate: true }
        );
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
