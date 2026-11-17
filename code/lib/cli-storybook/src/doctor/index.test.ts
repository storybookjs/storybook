import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as mainConfigFile from '../automigrate/helpers/mainConfigFile.ts';
import { doctor, getDoctorDiagnostics } from './index.ts';
import { DiagnosticType } from './types.ts';

const getStorybookData = vi.spyOn(mainConfigFile, 'getStorybookData');
const hasStorybookDependency = vi.spyOn(JsPackageManager, 'hasStorybookDependency');

const projectData = {
  configDir: '.storybook',
  packageManager: {} as JsPackageManager,
  mainConfig: {} as StorybookConfigRaw,
};

describe('getDoctorDiagnostics', () => {
  it('reports a captured configuration error instead of the version fallback', async () => {
    const results = await getDoctorDiagnostics({
      ...projectData,
      storybookVersion: undefined,
      configurationError: {
        title: 'Configuration Error',
        message: '❌ main.js is not readable',
      },
    });

    expect(results).toEqual([
      {
        type: DiagnosticType.CONFIGURATION_ERROR,
        title: 'Configuration Error',
        message: '❌ main.js is not readable',
        project: { configDir: '.storybook' },
      },
    ]);
  });

  it('reports the version fallback when the collection did not fail', async () => {
    const results = await getDoctorDiagnostics({ ...projectData, storybookVersion: undefined });

    expect(results).toHaveLength(1);
    expect(results[0].message).toContain('Unable to determine Storybook version');
  });

  describe('installed versions', () => {
    beforeEach(() => {
      hasStorybookDependency.mockReturnValue(true);
    });
    afterEach(() => hasStorybookDependency.mockReset());

    const diagnose = (
      installed: Record<string, string[]>,
      addonPeerRange = '^11.0.0-0'
    ): ReturnType<typeof getDoctorDiagnostics> =>
      getDoctorDiagnostics({
        ...projectData,
        storybookVersion: '11.0.0-beta.2',
        packageManager: {
          packageJsonPaths: ['package.json'],
          getAllDependencies: () => ({
            storybook: '^11.0.0-beta.2',
            'storybook-addon-tag-badges': '^3.1.0',
          }),
          getModulePackageJSON: async (name: string) => ({
            name,
            version: '3.1.0',
            peerDependencies: { storybook: addonPeerRange },
          }),
          findInstallations: async () => ({
            dependencies: Object.fromEntries(
              Object.entries(installed).map(([name, versions]) => [
                name,
                versions.map((version) => ({ version, location: '' })),
              ])
            ),
            duplicatedDependencies: Object.fromEntries(
              Object.entries(installed)
                .filter(([, versions]) => versions.length > 1)
                .map(([name, versions]) => [name, [...versions].sort()])
            ),
            infoCommand: 'npm ls',
            dedupeCommand: 'npm dedupe',
          }),
        } as unknown as JsPackageManager,
      });

    it.each([
      ['the stale copy is listed first', ['10.6.7', '11.0.0-beta.2'], ['11.0.0-beta.2', '10.6.7']],
      ['the current copy is listed first', ['11.0.0-beta.2', '10.6.7'], ['11.0.0-beta.2']],
    ])(
      'reports a critical duplicate next to the incompatible addon that installs it when %s',
      async (_, storybook, framework) => {
        const results = await diagnose(
          { storybook, '@storybook/react-vite': framework },
          '^10.0.0'
        );

        expect(results.map(({ type }) => type)).toEqual([
          DiagnosticType.INCOMPATIBLE_PACKAGES,
          DiagnosticType.DUPLICATED_DEPENDENCIES,
        ]);
        expect(results[1].message).toContain('Critical:');
        expect(results[1].message).toContain('10.6.7, 11.0.0-beta.2');
      }
    );

    it('counts a duplicated framework as critical', async () => {
      const results = await diagnose({
        storybook: ['11.0.0-beta.2'],
        '@storybook/react-vite': ['11.0.0-beta.2', '10.6.7'],
      });

      expect(results.map(({ type }) => type)).toEqual([DiagnosticType.DUPLICATED_DEPENDENCIES]);
      expect(results[0].message).toContain('Critical:');
    });

    it('reports the stale framework of a partial upgrade, not only its duplicated renderer', async () => {
      const results = await diagnose({
        storybook: ['11.0.0'],
        '@storybook/react': ['11.0.0', '10.6.7'],
        '@storybook/react-vite': ['10.6.7'],
      });

      expect(results.map(({ type }) => type)).toEqual([DiagnosticType.MISMATCHING_VERSIONS]);
      expect(results[0].message).toContain('@storybook/react-vite');
    });
  });
});

describe('doctor', () => {
  const reported = () =>
    [
      ...vi.mocked(logger.error).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.logBox).mock.calls,
    ]
      .map(([message]) => String(message))
      .join('\n');

  describe('when the config directory holds no main config', () => {
    beforeEach(() => {
      getStorybookData.mockRejectedValue(new MainFileMissingError({ location: '.storybook' }));
    });

    it('names the config directory it looked in, not undefined', async () => {
      await doctor({});

      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('.storybook: 1 problem found')
      );
      expect(reported()).toContain(
        'Could not find or evaluate your Storybook main.js config directory at'
      );
      expect(reported()).not.toContain('Unable to determine Storybook version');
      expect(reported()).not.toContain('undefined');
    });
  });

  describe('when the user named a config directory', () => {
    beforeEach(() => {
      getStorybookData.mockRejectedValue(
        new MainFileMissingError({ location: 'config/storybook' })
      );
    });

    it('names that directory in the report', async () => {
      await doctor({ configDir: 'config/storybook' });

      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('config/storybook: 1 problem found')
      );
      expect(vi.mocked(logger.logBox)).toHaveBeenCalledWith(
        expect.stringContaining('config/storybook'),
        expect.anything()
      );
    });
  });

  describe('when the collection rejects with something that is not an Error', () => {
    beforeEach(() => {
      getStorybookData.mockRejectedValue('main.js is not readable');
    });

    it('reports the rejection as the diagnostic', async () => {
      await doctor({ configDir: '.storybook' });

      expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
        expect.stringContaining('.storybook: 1 problem found')
      );
      expect(reported()).toContain('❌ main.js is not readable');
    });
  });
});
