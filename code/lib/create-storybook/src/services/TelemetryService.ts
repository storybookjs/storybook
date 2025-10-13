import type { ProjectType } from 'storybook/internal/cli';
import { telemetry } from 'storybook/internal/telemetry';

import { getProcessAncestry } from 'process-ancestry';

import type { GeneratorFeature } from '../generators/types';
import { VersionService } from './VersionService';

/** Service for tracking telemetry events during Storybook initialization */
export class TelemetryService {
  private disableTelemetry: boolean;
  private versionService: VersionService;

  constructor(disableTelemetry: boolean = false) {
    this.disableTelemetry = disableTelemetry;
    this.versionService = new VersionService();
  }

  /** Track a new user check step */
  async trackNewUserCheck(newUser: boolean): Promise<void> {
    if (this.disableTelemetry) {
      return;
    }

    await telemetry('init-step', {
      step: 'new-user-check',
      newUser,
    });
  }

  /** Track install type selection */
  async trackInstallType(installType: 'recommended' | 'light'): Promise<void> {
    if (this.disableTelemetry) {
      return;
    }

    await telemetry('init-step', {
      step: 'install-type',
      installType,
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
    if (this.disableTelemetry) {
      return;
    }

    await telemetry('init', data);
  }

  /** Track empty directory scaffolding event */
  async trackScaffolded(data: { packageManager: string; projectType: string }): Promise<void> {
    if (this.disableTelemetry) {
      return;
    }

    await telemetry('scaffolded-empty', data);
  }

  /** Create a features object from the selected features set */
  createFeaturesObject(selectedFeatures: Set<GeneratorFeature>): {
    dev: boolean;
    docs: boolean;
    test: boolean;
    onboarding: boolean;
  } {
    return {
      dev: true, // Always true during init
      docs: selectedFeatures.has('docs'),
      test: selectedFeatures.has('test'),
      onboarding: selectedFeatures.has('onboarding'),
    };
  }

  /**
   * Track init with complete context including version and CLI integration from ancestry This
   * method encapsulates all telemetry gathering and tracking logic
   */
  async trackInitWithContext(
    projectType: ProjectType,
    selectedFeatures: Set<GeneratorFeature>,
    newUser: boolean
  ): Promise<void> {
    if (this.disableTelemetry) {
      return;
    }

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
    const telemetryFeatures = this.createFeaturesObject(selectedFeatures);

    await telemetry('init', {
      projectType,
      features: telemetryFeatures,
      newUser,
      versionSpecifier,
      cliIntegration,
    });
  }
}
