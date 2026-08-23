import { describe, expect, it, vi } from 'vitest';

import {
  CommonJsGlobalInEsmError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';

import * as moduleUtils from '../../shared/utils/module.ts';
import * as interpretFiles from './interpret-files.ts';
import { loadMainConfig } from './load-main-config.ts';
import * as validateFiles from './validate-configuration-files.ts';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => 'export default {};'),
  writeFile: vi.fn(async () => {}),
  rm: vi.fn(async () => {}),
}));

vi.spyOn(validateFiles, 'validateConfigurationFiles').mockResolvedValue(undefined as any);
vi.spyOn(interpretFiles, 'getInterpretedFile').mockReturnValue('.storybook/main.ts');

describe('loadMainConfig', () => {
  it('returns the config when it loads cleanly', async () => {
    vi.spyOn(moduleUtils, 'importModule').mockResolvedValueOnce({ stories: [] });

    await expect(loadMainConfig({ configDir: '.storybook' })).resolves.toEqual({ stories: [] });
  });

  it('wraps a bare CommonJS-global error into CommonJsGlobalInEsmError', async () => {
    // Thrown at hook-call time inside e.g. a helper: no "in ES module scope" suffix, so the
    // migration-assistant polyfill never triggers.
    vi.spyOn(moduleUtils, 'importModule').mockRejectedValueOnce(
      new ReferenceError('__dirname is not defined')
    );

    await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
      CommonJsGlobalInEsmError
    );
  });

  it('wraps a failing polyfill retry (CommonJS global in an imported file)', async () => {
    // First import fails with the ESM-scope variant (triggers the polyfill), the retry of the
    // temp file fails again because the offending global lives in an imported file.
    vi.spyOn(moduleUtils, 'importModule')
      .mockRejectedValueOnce(new ReferenceError('__dirname is not defined in ES module scope'))
      .mockRejectedValueOnce(new ReferenceError('__dirname is not defined in ES module scope'));

    await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
      CommonJsGlobalInEsmError
    );
  });

  it('falls back to MainFileEvaluationError for unrelated failures', async () => {
    vi.spyOn(moduleUtils, 'importModule').mockRejectedValueOnce(new Error('some syntax error'));

    await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
      MainFileEvaluationError
    );
  });
});
