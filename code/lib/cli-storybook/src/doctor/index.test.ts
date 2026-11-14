import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import { MainFileMissingError } from 'storybook/internal/server-errors';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as mainConfigFile from '../automigrate/helpers/mainConfigFile.ts';
import { doctor, getDoctorDiagnostics } from './index.ts';
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
