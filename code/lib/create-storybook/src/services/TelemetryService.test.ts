import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectType } from 'storybook/internal/cli';
import { telemetry } from 'storybook/internal/telemetry';
import { Feature } from 'storybook/internal/types';

import { getProcessAncestry } from 'process-ancestry';

import { TelemetryService } from './TelemetryService';

vi.mock('storybook/internal/telemetry', { spy: true });
vi.mock('process-ancestry', { spy: true });

describe('TelemetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when telemetry is enabled', () => {
    let telemetryService: TelemetryService;

    beforeEach(() => {
      telemetryService = new TelemetryService(false);
    });

    it('should track new user check', async () => {
      await telemetryService.trackNewUserCheck(true);

      expect(telemetry).toHaveBeenCalledWith('init-step', {
        step: 'new-user-check',
        newUser: true,
      });
    });

    it('should track install type', async () => {
      await telemetryService.trackInstallType('recommended');

      expect(telemetry).toHaveBeenCalledWith('init-step', {
        step: 'install-type',
        installType: 'recommended',
      });
    });

    it('should track init event', async () => {
      const data = {
        projectType: ProjectType.REACT,
        features: {
          dev: true,
          docs: true,
          test: false,
          onboarding: true,
        },
        newUser: true,
        versionSpecifier: '8.0.0',
        cliIntegration: 'sv create',
      };

      await telemetryService.trackInit(data);

      expect(telemetry).toHaveBeenCalledWith('init', data);
    });

    it('should track scaffolded event', async () => {
      const data = {
        packageManager: 'npm',
        projectType: 'react-vite-ts',
      };

      await telemetryService.trackScaffolded(data);

      expect(telemetry).toHaveBeenCalledWith('scaffolded-empty', data);
    });
  });

  describe('when telemetry is disabled', () => {
    let telemetryService: TelemetryService;

    beforeEach(() => {
      telemetryService = new TelemetryService(true);
    });

    it('should not track new user check', async () => {
      await telemetryService.trackNewUserCheck(true);

      expect(telemetry).not.toHaveBeenCalled();
    });

    it('should not track install type', async () => {
      await telemetryService.trackInstallType('light');

      expect(telemetry).not.toHaveBeenCalled();
    });

    it('should not track init event', async () => {
      await telemetryService.trackInit({
        projectType: ProjectType.VUE3,
        features: {
          dev: true,
          docs: false,
          test: false,
          onboarding: false,
        },
        newUser: false,
      });

      expect(telemetry).not.toHaveBeenCalled();
    });

    it('should not track scaffolded event', async () => {
      await telemetryService.trackScaffolded({
        packageManager: 'yarn',
        projectType: 'vue-vite-ts',
      });

      expect(telemetry).not.toHaveBeenCalled();
    });
  });

  describe('trackInitWithContext', () => {
    it('should track init with version and CLI integration from ancestry', async () => {
      const telemetryService = new TelemetryService(false);
      const selectedFeatures = new Set([Feature.DOCS, Feature.TEST]);

      vi.mocked(getProcessAncestry).mockReturnValue([
        { command: 'npx storybook@8.0.5 init' },
      ] as any);

      await telemetryService.trackInitWithContext(ProjectType.REACT, selectedFeatures, true);

      expect(getProcessAncestry).toHaveBeenCalled();
      expect(telemetry).toHaveBeenCalledWith('init', {
        projectType: ProjectType.REACT,
        features: {
          dev: true,
          docs: true,
          test: true,
          onboarding: false,
        },
        newUser: true,
        versionSpecifier: '8.0.5',
        cliIntegration: undefined,
      });
    });

    it('should handle ancestry errors gracefully', async () => {
      const telemetryService = new TelemetryService(false);
      const selectedFeatures = new Set([]);

      vi.mocked(getProcessAncestry).mockImplementation(() => {
        throw new Error('Ancestry error');
      });

      await telemetryService.trackInitWithContext(ProjectType.VUE3, selectedFeatures, false);

      expect(telemetry).toHaveBeenCalledWith('init', {
        projectType: ProjectType.VUE3,
        features: {
          dev: true,
          docs: false,
          test: false,
          onboarding: false,
        },
        newUser: false,
        versionSpecifier: undefined,
        cliIntegration: undefined,
      });
    });

    it('should not track when telemetry is disabled', async () => {
      const telemetryService = new TelemetryService(true);
      const selectedFeatures = new Set([Feature.DOCS]);

      await telemetryService.trackInitWithContext(ProjectType.ANGULAR, selectedFeatures, true);

      expect(getProcessAncestry).not.toHaveBeenCalled();
      expect(telemetry).not.toHaveBeenCalled();
    });

    it('should detect CLI integration from ancestry', async () => {
      const telemetryService = new TelemetryService(false);
      const selectedFeatures = new Set([]);

      vi.mocked(getProcessAncestry).mockReturnValue([{ command: 'sv create my-app' }] as any);

      await telemetryService.trackInitWithContext(ProjectType.NEXTJS, selectedFeatures, false);

      expect(telemetry).toHaveBeenCalledWith(
        'init',
        expect.objectContaining({
          cliIntegration: 'sv create',
        })
      );
    });
  });
});
