import { readFile, rm, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CommonJsGlobalInEsmError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';

import * as moduleUtils from '../../shared/utils/module.ts';
import * as interpretFiles from './interpret-files.ts';
import { loadMainConfig } from './load-main-config.ts';
import * as validateFiles from './validate-configuration-files.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  // The polyfill path reads the main file and writes/removes a temp copy; the test never asserts
  // disk state, so redirect these spies to no-ops instead of touching the real filesystem.
  vi.mocked(readFile).mockResolvedValue('export default {};');
  vi.mocked(writeFile).mockResolvedValue();
  vi.mocked(rm).mockResolvedValue();
  vi.spyOn(validateFiles, 'validateConfigurationFiles').mockResolvedValue(undefined as any);
  vi.spyOn(interpretFiles, 'getInterpretedFile').mockReturnValue('.storybook/main.ts');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadMainConfig', () => {
  describe('when the config loads cleanly', () => {
    beforeEach(() => {
      vi.spyOn(moduleUtils, 'importModule').mockResolvedValueOnce({ stories: [] });
    });

    it('returns the config', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).resolves.toEqual({ stories: [] });
    });
  });

  describe('when importing throws a bare CommonJS-global error', () => {
    beforeEach(() => {
      // Thrown at hook-call time inside e.g. a helper: no "in ES module scope" suffix, so the
      // migration-assistant polyfill never triggers.
      vi.spyOn(moduleUtils, 'importModule').mockRejectedValueOnce(
        new ReferenceError('__dirname is not defined')
      );
    });

    it('categorizes the error', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
        CommonJsGlobalInEsmError
      );
    });
  });

  describe('when the polyfill retry fails in an imported file', () => {
    beforeEach(() => {
      // First import fails with the ESM-scope variant (triggers the polyfill), the retry of the
      // temp file fails again because the offending global lives in an imported file.
      const retryError = new ReferenceError('__dirname is not defined in ES module scope');
      retryError.stack = [
        'ReferenceError: __dirname is not defined in ES module scope',
        `    at file://${process.cwd()}/.storybook/paths.ts:2:21`,
        `    at file://${process.cwd()}/.storybook/main.tmp..ts:9:1`,
      ].join('\n');
      vi.spyOn(moduleUtils, 'importModule')
        .mockRejectedValueOnce(new ReferenceError('__dirname is not defined in ES module scope'))
        .mockRejectedValueOnce(retryError);
    });

    it('categorizes the error and names the imported file', async () => {
      const error = (await loadMainConfig({ configDir: '.storybook' }).catch(
        (e: unknown) => e
      )) as Error;

      expect(error).toBeInstanceOf(CommonJsGlobalInEsmError);
      // The subject names the imported file, and never the throwaway temp copy.
      const subject = error.message.split('\n')[0];
      expect(subject).toContain('.storybook/paths.ts');
      expect(subject).not.toContain('main.tmp');
    });
  });

  describe('when importing throws an unrelated error', () => {
    beforeEach(() => {
      vi.spyOn(moduleUtils, 'importModule').mockRejectedValueOnce(new Error('some syntax error'));
    });

    it('falls back to MainFileEvaluationError', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
        MainFileEvaluationError
      );
    });
  });
});
