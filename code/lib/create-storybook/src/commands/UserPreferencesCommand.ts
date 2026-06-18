import type { ProjectType } from 'storybook/internal/cli';
import { globalSettings } from 'storybook/internal/cli';
import { isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type {
  SupportedBuilder,
  SupportedFramework,
  SupportedRenderer,
} from 'storybook/internal/types';
import { Feature } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { CommandOptions } from '../generators/types.ts';
import { createPromptCancelOptions } from '../prompt-cancel.ts';
import { FeatureCompatibilityService } from '../services/FeatureCompatibilityService.ts';
import { TelemetryService } from '../services/TelemetryService.ts';

export type InstallType = 'recommended' | 'light';

export interface UserPreferencesResult {
  /** Whether the user is a new user */
  newUser: boolean;
  /**
   * The features that the user has selected explicitly or implicitly and which can actually be
   * installed based on the project type or other constraints.
   */
  selectedFeatures: Set<Feature>;
}

export interface UserPreferencesOptions {
  skipPrompt?: boolean;
  framework: SupportedFramework | null;
  builder: SupportedBuilder;
  renderer: SupportedRenderer;
  projectType: ProjectType;
  isTestFeatureAvailable: boolean;
  isAiSetupAvailable: boolean;
}

/**
 * Command for gathering user preferences during Storybook initialization
 *
 * Responsibilities:
 *
 * - Display version information
 * - Prompt for new user / onboarding preference
 * - Prompt for install type (recommended vs minimal)
 * - Run feature compatibility checks
 * - Track telemetry events
 */
export class UserPreferencesCommand {
  constructor(
    private readonly commandOptions: CommandOptions,
    private readonly telemetryService = new TelemetryService()
  ) {}

  /** Execute user preferences gathering */
  async execute(options: UserPreferencesOptions): Promise<UserPreferencesResult> {
    // Display version information
    const isInteractive = process.stdout.isTTY && !isCI();
    const skipPrompt = !isInteractive || !!this.commandOptions.yes;

    // Get new user preference
    const newUser = await this.promptNewUser(skipPrompt);

    const commandOptionsFeatures = this.handleCommandOptionsFeatureFlag();

    if (commandOptionsFeatures) {
      return {
        newUser,
        selectedFeatures: commandOptionsFeatures,
      };
    }

    // Get install type
    const installType: InstallType =
      !newUser && !this.commandOptions.features
        ? await this.promptInstallType(skipPrompt, options.isTestFeatureAvailable)
        : 'recommended';

    // Ask about AI setup (only available for compatible projects, e.g. React + Vite)
    const useAiForSetup = options.isAiSetupAvailable ? await this.promptAiSetup(skipPrompt) : false;

    const selectedFeatures = this.determineFeatures(
      installType,
      newUser,
      options.isTestFeatureAvailable,
      options.projectType,
      useAiForSetup
    );

    return { newUser, selectedFeatures };
  }

  private handleCommandOptionsFeatureFlag(): Set<Feature> | null {
    if (this.commandOptions.features && this.commandOptions.features?.length > 0) {
      logger.warn(dedent`
        Skipping feature validation as these features were explicitly selected:
        ${Array.from(this.commandOptions.features).join(', ')}
      `);
      return new Set(this.commandOptions.features);
    } else if (this.commandOptions.features?.length === 0) {
      logger.warn(dedent`
        All features have been disabled via --no-features flag.
      `);
      return new Set();
    }

    return null;
  }

  /** Prompt user about onboarding */
  private async promptNewUser(skipPrompt: boolean): Promise<boolean> {
    const settings = await globalSettings();
    const { skipOnboarding } = settings.value.init || {};
    let isNewUser = skipOnboarding !== undefined ? !skipOnboarding : true;

    if (skipPrompt || skipOnboarding) {
      settings.value.init ||= {};
      settings.value.init.skipOnboarding = !!skipOnboarding;
    } else {
      isNewUser = await prompt.select(
        {
          message: 'New to Storybook?',
          options: [
            {
              label: `${picocolors.bold('Yes:')} Help me with onboarding`,
              value: true,
            },
            {
              label: `${picocolors.bold('No:')} Skip onboarding & don't ask again`,
              value: false,
            },
          ],
        },
        createPromptCancelOptions(this.telemetryService, 'new-user-ask-onboarding')
      );

      settings.value.init ||= {};
      settings.value.init.skipOnboarding = !isNewUser;

      if (typeof isNewUser !== 'undefined') {
        await this.telemetryService.trackNewUserCheck(isNewUser);
      }
    }

    try {
      await settings.save();
    } catch (err) {
      logger.warn(`Failed to save user settings: ${err}`);
    }

    return isNewUser;
  }

  /** Prompt user for install type */
  private async promptInstallType(
    skipPrompt: boolean,
    isTestFeatureAvailable: boolean
  ): Promise<InstallType> {
    let installType: InstallType = 'recommended';

    const recommendedLabel = isTestFeatureAvailable
      ? `Recommended: Component development, docs, and testing features.`
      : `Recommended: Component development and docs`;

    if (!skipPrompt) {
      installType = await prompt.select(
        {
          message: 'What configuration should we install?',
          options: [
            {
              label: recommendedLabel,
              value: 'recommended',
            },
            {
              label: `Minimal: Just the essentials for component development.`,
              value: 'light',
            },
          ],
        },
        createPromptCancelOptions(this.telemetryService, 'install-type')
      );
    }

    await this.telemetryService.trackInstallType(installType);

    return installType;
  }

  /** Determine features based on install type and user status */
  private determineFeatures(
    installType: InstallType,
    newUser: boolean,
    isTestFeatureAvailable: boolean,
    projectType: ProjectType,
    useAiForSetup: boolean
  ): Set<Feature> {
    const features = new Set<Feature>();

    if (installType === 'recommended') {
      features.add(Feature.DOCS);
      features.add(Feature.A11Y);

      if (isTestFeatureAvailable) {
        features.add(Feature.TEST);
      }
      if (newUser && FeatureCompatibilityService.supportsOnboarding(projectType)) {
        features.add(Feature.ONBOARDING);
      }
    }

    // If user has asked for AI setup, we provide the MCP addon and ensure test is included
    if (useAiForSetup) {
      features.add(Feature.AI);
      if (isTestFeatureAvailable) {
        features.add(Feature.TEST);
      }

      // We leave onboarding for sandboxes as we test onboarding in CI
      if (!process.env.IN_STORYBOOK_SANDBOX) {
        features.delete(Feature.ONBOARDING);
      }
    }

    return features;
  }

  /** Prompt user about AI-assisted Storybook setup */
  private async promptAiSetup(skipPrompt: boolean): Promise<boolean> {
    const useAi = skipPrompt
      ? true
      : await prompt.confirm(
          {
            message: 'Would you like to install AI features (MCP addon and prompt suggestions)?',
          },
          createPromptCancelOptions(this.telemetryService, 'ai-setup')
        );

    if (useAi) {
      await this.telemetryService.trackAiSetupNudge({ skipPrompt });
    }

    return useAi;
  }
}

export const executeUserPreferences = ({
  options,
  ...restOptions
}: UserPreferencesOptions & {
  options: CommandOptions;
}) => {
  return new UserPreferencesCommand(options).execute(restOptions);
};
