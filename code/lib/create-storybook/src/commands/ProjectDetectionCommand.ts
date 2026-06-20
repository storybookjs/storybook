import { ProjectType } from 'storybook/internal/cli';
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
      if (detected === ProjectType.UNDETECTED) {
        projectType = await this.handleUndetectedProjectType();
      } else {
        projectType = detected;
        if (detected === ProjectType.REACT_NATIVE && !this.options.yes) {
          projectType = await this.promptReactNativeVariant();
        }
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

  /** Handle the case where Storybook cannot auto-detect a project type */
  private async handleUndetectedProjectType(): Promise<ProjectType> {
    if (this.options.yes) {
      this.reportUndetectedProjectType();
    }

    const choice = await prompt.select(
      {
        message: "We couldn't detect a supported framework. What would you like to do?",
        options: [
          {
            label: `${picocolors.bold('HTML')}: install Storybook for a plain HTML project`,
            value: 'html',
          },
          {
            label: `${picocolors.bold('Select a framework')}: choose a supported framework manually`,
            value: 'framework',
          },
          {
            label: `${picocolors.bold('Abort')}: exit without installing Storybook`,
            value: 'abort',
          },
        ],
      },
      createPromptCancelOptions(this.telemetryService, 'project-type-undetected')
    );

    if (choice === 'html') {
      return ProjectType.HTML;
    }

    if (choice === 'framework') {
      return this.promptFrameworkType();
    }

    logger.warn('Aborting Storybook initialization...');
    return process.exit(0);
  }

  /** Prompt user to select a framework after auto-detection failed */
  private async promptFrameworkType(): Promise<ProjectType> {
    const manualType = await prompt.select(
      {
        message: 'Choose a framework to install:',
        options: Object.values(ProjectType)
          .filter(
            (type) =>
              ![
                ProjectType.UNDETECTED,
                ProjectType.UNSUPPORTED,
                ProjectType.NX,
                ProjectType.HTML,
              ].includes(type)
          )
          .map((type) => ({
            label: this.formatProjectTypeLabel(type),
            value: type,
          })),
      },
      createPromptCancelOptions(this.telemetryService, 'project-type-manual')
    );

    return manualType as ProjectType;
  }

  /** Emit the undetected project type error that non-interactive flows need */
  private reportUndetectedProjectType(): never {
    logger.error(dedent`
      Unable to initialize Storybook in this directory.

      Storybook couldn't detect a supported framework or configuration for your project.

      If this is a plain HTML project, rerun Storybook with:
        --type html

      For example:
        npm create storybook@latest -- --type html

      Otherwise, make sure you're inside a framework project (for example React, Vue, Svelte, Angular, or Next.js) and that its dependencies are installed.
    `);
    throw new HandledError('Storybook failed to detect your project type');
  }

  private formatProjectTypeLabel(type: ProjectType) {
    switch (type) {
      case ProjectType.ANGULAR:
        return 'Angular';
      case ProjectType.EMBER:
        return 'Ember';
      case ProjectType.HTML:
        return 'HTML';
      case ProjectType.NEXTJS:
        return 'Next.js';
      case ProjectType.NUXT:
        return 'Nuxt';
      case ProjectType.PREACT:
        return 'Preact';
      case ProjectType.QWIK:
        return 'Qwik';
      case ProjectType.REACT:
        return 'React';
      case ProjectType.REACT_NATIVE:
        return 'React Native';
      case ProjectType.REACT_NATIVE_AND_RNW:
        return 'React Native + React Native Web';
      case ProjectType.REACT_NATIVE_WEB:
        return 'React Native Web';
      case ProjectType.REACT_SCRIPTS:
        return 'React Scripts';
      case ProjectType.SERVER:
        return 'Server';
      case ProjectType.SOLID:
        return 'Solid';
      case ProjectType.SVELTE:
        return 'Svelte';
      case ProjectType.SVELTEKIT:
        return 'SvelteKit';
      case ProjectType.TANSTACK_REACT:
        return 'TanStack React';
      case ProjectType.VUE3:
        return 'Vue 3';
      case ProjectType.WEB_COMPONENTS:
        return 'Web Components';
      default:
        return type;
    }
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
