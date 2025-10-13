import type { JsPackageManager } from 'storybook/internal/common';
import { isCI } from 'storybook/internal/common';
import { CLI_COLORS, logger, prompt } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { GeneratorFeature } from '../generators/types';
import { FeatureCompatibilityService } from '../services/FeatureCompatibilityService';
import { TelemetryService } from '../services/TelemetryService';
import { VersionService } from '../services/VersionService';

export type InstallType = 'recommended' | 'light';

export interface UserPreferencesResult {
  newUser: boolean;
  installType: InstallType;
  selectedFeatures: Set<GeneratorFeature>;
}

export interface UserPreferencesOptions {
  skipPrompt?: boolean;
  disableTelemetry?: boolean;
  yes?: boolean;
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
  private versionService: VersionService;
  private telemetryService: TelemetryService;
  private featureService: FeatureCompatibilityService;

  constructor(disableTelemetry: boolean = false) {
    this.versionService = new VersionService();
    this.telemetryService = new TelemetryService(disableTelemetry);
    this.featureService = new FeatureCompatibilityService();
  }

  /** Execute user preferences gathering */
  async execute(
    packageManager: JsPackageManager,
    options: UserPreferencesOptions
  ): Promise<UserPreferencesResult> {
    // Display version information
    await this.displayVersionInfo(packageManager);

    const isInteractive = process.stdout.isTTY && !isCI();
    const skipPrompt = !isInteractive || options.yes;

    // Get new user preference
    const newUser = await this.promptNewUser(skipPrompt);
    if (typeof newUser === 'undefined') {
      logger.log('Canceling...');
      process.exit(0);
    }

    // Get install type
    let installType: InstallType = 'recommended';
    if (!newUser) {
      const install = await this.promptInstallType(skipPrompt);
      if (typeof install === 'undefined') {
        logger.log('Canceling...');
        process.exit(0);
      }
      installType = install;
    }

    // Determine selected features
    const selectedFeatures = this.determineFeatures(installType, newUser);

    // Validate test feature compatibility
    if (selectedFeatures.has('test') && isInteractive) {
      const isCompatible = await this.validateTestFeature(packageManager, selectedFeatures);
      if (!isCompatible) {
        process.exit(0);
      }
    }

    return { newUser, installType, selectedFeatures };
  }

  /** Display version information and warnings */
  private async displayVersionInfo(packageManager: JsPackageManager): Promise<void> {
    const { currentVersion, latestVersion, isPrerelease, isOutdated } =
      await this.versionService.getVersionInfo(packageManager);

    logger.intro(CLI_COLORS.info(`Initializing Storybook`));

    if (isOutdated && !isPrerelease) {
      logger.warn(dedent`
        This version is behind the latest release, which is: ${picocolors.bold(latestVersion)}!
        You likely ran the init command through npx, which can use a locally cached version.
        
        To get the latest, please run: ${picocolors.bold('npx storybook@latest init')}
        You may want to CTRL+C to stop, and run with the latest version instead.
      `);
    } else if (isPrerelease) {
      logger.warn(`This is a pre-release version: ${picocolors.bold(currentVersion)}`);
    } else {
      logger.info(`Adding Storybook version ${picocolors.bold(currentVersion)} to your project`);
    }
  }

  /** Prompt user about onboarding */
  private async promptNewUser(skipPrompt: boolean): Promise<boolean | undefined> {
    if (skipPrompt) {
      return true;
    }

    const newUser = await prompt.select({
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

    if (typeof newUser !== 'undefined') {
      await this.telemetryService.trackNewUserCheck(newUser);
    }

    return newUser;
  }

  /** Prompt user for install type */
  private async promptInstallType(skipPrompt: boolean): Promise<InstallType | undefined> {
    let installType: InstallType = 'recommended';

    if (!skipPrompt) {
      const configuration = await prompt.select({
        message: 'What configuration should we install?',
        options: [
          {
            label: `${picocolors.bold('Recommended:')} Includes component development, docs, and testing features.`,
            value: 'recommended',
          },
          {
            label: `${picocolors.bold('Minimal:')} Just the essentials for component development.`,
            value: 'light',
          },
        ],
      });

      if (typeof configuration === 'undefined') {
        return configuration;
      }
      installType = configuration as InstallType;
    }

    await this.telemetryService.trackInstallType(installType);
    return installType;
  }

  /** Determine features based on install type and user status */
  private determineFeatures(installType: InstallType, newUser: boolean): Set<GeneratorFeature> {
    const features = new Set<GeneratorFeature>();

    if (installType === 'recommended') {
      features.add('docs');
      // Don't install test in CI but install in non-TTY environments like agentic installs
      if (!isCI()) {
        features.add('test');
      }
      if (newUser) {
        features.add('onboarding');
      }
    }

    return features;
  }

  /** Validate test feature compatibility and prompt user if issues found */
  private async validateTestFeature(
    packageManager: JsPackageManager,
    selectedFeatures: Set<GeneratorFeature>
  ): Promise<boolean> {
    const result = await this.featureService.validateTestFeatureCompatibility(
      packageManager,
      process.cwd()
    );

    if (!result.compatible && result.reasons) {
      const shouldContinue = await prompt.confirm({
        message: dedent`
          ${result.reasons.join('\n')}
          Do you want to continue without Storybook's testing features?
        `,
      });

      if (shouldContinue) {
        selectedFeatures.delete('test');
        return true;
      }
      return false;
    }

    return true;
  }
}

export const executeUserPreferences = (
  packageManager: JsPackageManager,
  options: UserPreferencesOptions
) => {
  return new UserPreferencesCommand(options.disableTelemetry).execute(packageManager, options);
};
