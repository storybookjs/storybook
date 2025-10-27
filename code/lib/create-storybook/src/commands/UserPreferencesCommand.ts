import type { ProjectType } from 'storybook/internal/cli';
import { globalSettings } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import { isCI } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

import picocolors from 'picocolors';

import type { DependencyCollector } from '../dependency-collector';
import type { GeneratorFeature } from '../generators/types';
import { FeatureCompatibilityService } from '../services/FeatureCompatibilityService';
import { TelemetryService } from '../services/TelemetryService';

export type InstallType = 'recommended' | 'light';

export interface UserPreferencesResult {
  /** Whether the user is a new user */
  newUser: boolean;
  /** The type of installation to perform (recommended vs minimal) */
  installType: InstallType;
  /**
   * The features that the user has selected explicitly or implicitly and which can actually be
   * installed based on the project type or other constraints.
   */
  selectedFeatures: Set<GeneratorFeature>;
}

export interface UserPreferencesOptions {
  skipPrompt?: boolean;
  disableTelemetry?: boolean;
  yes?: boolean;
  framework: SupportedFramework | undefined;
  builder: SupportedBuilder;
  projectType: ProjectType;
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
  private telemetryService: TelemetryService;

  constructor(
    private dependencyCollector: DependencyCollector,
    private featureService = new FeatureCompatibilityService(),
    disableTelemetry: boolean = false
  ) {
    this.telemetryService = new TelemetryService(disableTelemetry);
  }

  /** Execute user preferences gathering */
  async execute(
    packageManager: JsPackageManager,
    options: UserPreferencesOptions
  ): Promise<UserPreferencesResult> {
    // Display version information
    const isInteractive = process.stdout.isTTY && !isCI();
    const skipPrompt = !isInteractive || !!options.yes;

    const isTestFeatureAvailable = await this.isTestFeatureAvailable(
      packageManager,
      options.framework,
      options.builder
    );

    // Get new user preference
    const newUser = await this.promptNewUser(skipPrompt);

    // Get install type
    const installType: InstallType = !newUser
      ? await this.promptInstallType(skipPrompt, isTestFeatureAvailable)
      : 'recommended';

    const selectedFeatures = this.determineFeatures(
      installType,
      newUser,
      isTestFeatureAvailable,
      options.projectType
    );

    return { newUser, installType, selectedFeatures };
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
      isNewUser = await prompt.select({
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
      });

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
      ? `Recommended: Includes component development, docs and testing features.`
      : `Recommended: Includes component development and docs`;

    if (!skipPrompt) {
      installType = await prompt.select({
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
      });
    }

    await this.telemetryService.trackInstallType(installType);

    return installType;
  }

  /** Determine features based on install type and user status */
  private determineFeatures(
    installType: InstallType,
    newUser: boolean,
    isTestFeatureAvailable: boolean,
    projectType: ProjectType
  ): Set<GeneratorFeature> {
    const features = new Set<GeneratorFeature>();

    if (installType === 'recommended') {
      features.add('docs');
      features.add('a11y');
      // Don't install test in CI but install in non-TTY environments like agentic installs
      if (isTestFeatureAvailable) {
        features.add('test');
      }
      if (newUser && FeatureCompatibilityService.supportsOnboarding(projectType)) {
        features.add('onboarding');
      }
    }

    return features;
  }

  /** Validate test feature compatibility and prompt user if issues found */
  private async isTestFeatureAvailable(
    packageManager: JsPackageManager,
    framework: SupportedFramework | undefined,
    builder: SupportedBuilder
  ): Promise<boolean> {
    const result = await this.featureService.validateTestFeatureCompatibility(
      packageManager,
      framework,
      builder,
      process.cwd()
    );

    return result.compatible;
  }
}

export const executeUserPreferences = (
  packageManager: JsPackageManager,
  options: UserPreferencesOptions & { dependencyCollector: DependencyCollector }
) => {
  return new UserPreferencesCommand(
    options.dependencyCollector,
    undefined,
    options.disableTelemetry
  ).execute(packageManager, options);
};
