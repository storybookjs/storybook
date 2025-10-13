import type { ProjectType } from 'storybook/internal/cli';
import { telemetry } from 'storybook/internal/telemetry';

import type { GeneratorFeature } from '../generators/types';

/** Service for tracking telemetry events during Storybook initialization */
export class TelemetryService {
  private disableTelemetry: boolean;

  constructor(disableTelemetry: boolean = false) {
    this.disableTelemetry = disableTelemetry;
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
}
