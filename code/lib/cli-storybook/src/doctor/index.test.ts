import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as mainConfigFile from '../automigrate/helpers/mainConfigFile.ts';
import { doctor, getDoctorDiagnostics } from './index.ts';
import type { DoctorCheckResult } from './types.ts';
import { DiagnosticType } from './types.ts';

const getStorybookData = vi.spyOn(mainConfigFile, 'getStorybookData');

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
});

describe('getDoctorDiagnostics overrides check', () => {
  const hasStorybookDependency = vi.spyOn(JsPackageManager, 'hasStorybookDependency');

  afterAll(() => {
    hasStorybookDependency.mockRestore();
  });

  it('reports overrides pinning Storybook packages outside the installed version', async () => {
    hasStorybookDependency.mockReturnValue(true);
    const packageManager = {
      packageJsonPaths: ['package.json'],
      getAllDependencies: () => ({ storybook: '^11.0.0' }),
      findInstallations: async () => undefined,
      getOverrideSources: () => [
        {
          path: 'package.json',
          field: 'overrides',
          overrides: { '@storybook/addon-mcp': { storybook: '~10.5.3' } },
        },
      ],
    } as unknown as JsPackageManager;

    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '11.0.0',
    });

    expect(results.filter(({ type }) => type === DiagnosticType.STORYBOOK_OVERRIDES))
      .toMatchInlineSnapshot(`
        [
          {
            "message": "These overrides force Storybook packages to versions that exclude 11.0.0:

        - package.json: overrides › @storybook/addon-mcp › storybook = ~10.5.3

        Update these entries to 11.0.0 or remove them, then reinstall your dependencies.",
            "project": {
              "configDir": ".storybook",
            },
            "title": "Overrides pin Storybook packages to another version",
            "type": "storybook_overrides",
          },
        ]
      `);
  });
});

describe('getDoctorDiagnostics deprecated packages check', () => {
  const getAllDependencies = vi.fn<() => Record<string, string>>();
  const packageManager = {
    packageJsonPaths: ['package.json'],
    getAllDependencies,
    findInstallations: async () => undefined,
    getOverrideSources: () => [],
  } as unknown as JsPackageManager;

  // Select the deprecation diagnostics by what they say, not by internal type constants.
  const deprecationDiagnostics = (results: DoctorCheckResult[]) =>
    results.filter(({ message }) => message.includes('deprecated packages since'));

  beforeEach(() => {
    getAllDependencies.mockReturnValue({ storybook: '^11.0.0' });
  });

  it('warns that @storybook/nextjs is deprecated when it is installed on Storybook 11', async () => {
    getAllDependencies.mockReturnValue({ storybook: '^11.0.0', '@storybook/nextjs': '^11.0.0' });

    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '11.0.0',
    });

    expect(deprecationDiagnostics(results)).toHaveLength(1);
    const [{ message, project }] = deprecationDiagnostics(results);
    expect(message).toContain(
      '- @storybook/nextjs is deprecated and will be removed in Storybook 12.'
    );
    expect(message).toContain(
      'Migrate off it by running `npx storybook automigrate nextjs-to-nextjs-vite`.'
    );
    expect(message).toContain(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nextjs-storybooknextjs-is-deprecated'
    );
    expect(project).toEqual({ configDir: '.storybook' });
  });

  it('does not warn when @storybook/nextjs is not installed', async () => {
    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '11.0.0',
    });

    expect(deprecationDiagnostics(results)).toHaveLength(0);
  });

  it('still warns on Storybook 12, where the deprecation is not yet removed', async () => {
    getAllDependencies.mockReturnValue({ storybook: '^12.0.0', '@storybook/nextjs': '^12.0.0' });

    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '12.0.0',
    });

    expect(deprecationDiagnostics(results)).toHaveLength(1);
    expect(deprecationDiagnostics(results)[0].message).toContain('will be removed in Storybook 12');
  });

  it('does not warn on Storybook versions before the deprecation', async () => {
    getAllDependencies.mockReturnValue({ storybook: '^10.0.0', '@storybook/nextjs': '^10.0.0' });

    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '10.0.0',
    });

    expect(deprecationDiagnostics(results)).toHaveLength(0);
  });

  it('warns for other deprecated packages from the shared table, without claiming removal', async () => {
    getAllDependencies.mockReturnValue({
      storybook: '^11.0.0',
      '@storybook/addon-notes': '^5.0.0',
    });

    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '11.0.0',
    });

    expect(deprecationDiagnostics(results)).toHaveLength(1);
    expect(deprecationDiagnostics(results)[0].message).toContain(
      '- @storybook/addon-notes is deprecated.'
    );
    expect(deprecationDiagnostics(results)[0].message).not.toContain(
      'will be removed in Storybook 12'
    );
  });

  it('stays silent about a deprecation whose migration was skipped this run, while warning about others', async () => {
    getAllDependencies.mockReturnValue({
      storybook: '^11.0.0',
      '@storybook/nextjs': '^11.0.0',
      '@storybook/addon-notes': '^5.0.0',
    });

    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '11.0.0',
      warnedFixIds: ['nextjs-to-nextjs-vite'],
    });

    expect(deprecationDiagnostics(results)).toHaveLength(1);
    expect(deprecationDiagnostics(results)[0].message).toContain('- @storybook/addon-notes');
    expect(deprecationDiagnostics(results)[0].message).not.toContain('- @storybook/nextjs');
  });

  it('still warns about a deprecation when its migration cancelled from run, which printed no skip warning', async () => {
    getAllDependencies.mockReturnValue({ storybook: '^11.0.0', '@storybook/nextjs': '^11.0.0' });

    // A fix that cancelled itself from `run` is skipped but was never warned, so it is not in the
    // list and the doctor keeps its deprecation warning.
    const results = await getDoctorDiagnostics({
      ...projectData,
      packageManager,
      storybookVersion: '11.0.0',
      warnedFixIds: [],
    });

    expect(deprecationDiagnostics(results)).toHaveLength(1);
    expect(deprecationDiagnostics(results)[0].message).toContain('- @storybook/nextjs');
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
