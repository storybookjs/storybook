import type { ProjectType } from 'storybook/internal/cli';
import { telemetry } from 'storybook/internal/telemetry';
import { Feature } from 'storybook/internal/types';

import { getProcessAncestry } from 'process-ancestry';

import { VersionService } from './VersionService.ts';

/** Service for tracking telemetry events during Storybook initialization */
export class TelemetryService {
  private versionService: VersionService;

  constructor() {
    this.versionService = new VersionService();
  }

  /** Track a new user check step */
  async trackNewUserCheck(newUser: boolean): Promise<void> {
    await telemetry('init-step', {
      step: 'new-user-check',
      newUser,
    });
  }

  /** Track install type selection */
  async trackInstallType(installType: 'recommended' | 'light'): Promise<void> {
    await telemetry('init-step', {
      step: 'install-type',
      installType,
    });
  }

  /** Track when a user accepts the AI setup nudge prompt */
  async trackAiSetupNudge(context: { skipPrompt: boolean }): Promise<void> {
    await telemetry('ai-prompt-nudge', {
      id: 'setup',
      origin: 'init',
      context,
    });
  }

  /** Track Playwright prompt decision (install | skip | aborted) */
  async trackPlaywrightPromptDecision(
    result: 'installed' | 'skipped' | 'aborted' | 'failed'
  ): Promise<void> {
    await telemetry('init-step', {
      step: 'playwright-install',
      result,
    });
  }

  /** Track the main init event with all metadata */
  async trackInit(data: {
    projectType: ProjectType;
    features: {
      dev: boolean;
      docs: boolean;
      test: boolean;
      onboarding: boolean;
    };
    newUser: boolean;
    versionSpecifier?: string;
    cliIntegration?: string;
  }): Promise<void> {
    await telemetry('init', data);
  }

  /** Track empty directory scaffolding event */
  async trackScaffolded(data: { packageManager: string; projectType: string }): Promise<void> {
    await telemetry('scaffolded-empty', data);
  }

  /**
   * Track init with complete context including version and CLI integration from ancestry This
   * method encapsulates all telemetry gathering and tracking logic
   */
  async trackInitWithContext(
    projectType: ProjectType,
    selectedFeatures: Set<Feature>,
    newUser: boolean
  ): Promise<void> {
    // Get telemetry info from process ancestry
    let versionSpecifier: string | undefined;
    let cliIntegration: string | undefined;

    try {
      const ancestry = getProcessAncestry();
      versionSpecifier = this.versionService.getStorybookVersionFromAncestry(ancestry);
      cliIntegration = this.versionService.getCliIntegrationFromAncestry(ancestry);
    } catch {
      // Ignore errors getting ancestry
    }

    // Create features object and track
    const telemetryFeatures = {
      dev: true, // Always true during init
      docs: selectedFeatures.has(Feature.DOCS),
      test: selectedFeatures.has(Feature.TEST),
      onboarding: selectedFeatures.has(Feature.ONBOARDING),
    };

    await telemetry('init', {
      projectType,
      features: telemetryFeatures,
      newUser,
      versionSpecifier,
      cliIntegration,
    });
  }
}
