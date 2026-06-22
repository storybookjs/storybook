import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MainFileESMOnlyError } from 'storybook/internal/server-errors';

import * as moduleUtils from '../../shared/utils/module.ts';
import { getInterpretedFile } from './interpret-files.ts';
import { loadMainConfig } from './load-main-config.ts';
import { validateConfigurationFiles } from './validate-configuration-files.ts';

vi.mock('../../shared/utils/module.ts', { spy: true });
vi.mock('./interpret-files.ts', { spy: true });
vi.mock('./validate-configuration-files.ts', { spy: true });

describe('loadMainConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateConfigurationFiles).mockResolvedValue(undefined);
    vi.mocked(getInterpretedFile).mockReturnValue('/project/.storybook/main.ts');
  });

  it('returns the evaluated config when the main file loads successfully', async () => {
    const config = { stories: ['../src/**/*.stories.tsx'] };
    vi.mocked(moduleUtils.importModule).mockResolvedValue(config);

    await expect(loadMainConfig({ configDir: '.storybook' })).resolves.toEqual(config);
  });

  it('categorizes "__dirname is not defined" as a MainFileESMOnlyError with ESM migration guidance', async () => {
    vi.mocked(moduleUtils.importModule).mockRejectedValue(
      new ReferenceError('__dirname is not defined')
    );

    const promise = loadMainConfig({ configDir: '.storybook' });

    await expect(promise).rejects.toBeInstanceOf(MainFileESMOnlyError);
    await expect(promise).rejects.toThrowError(/__dirname/);
    await expect(promise).rejects.toThrowError(/import\.meta\.url/);
    await expect(promise).rejects.toThrowError(/main\.ts/);
  });

  it('categorizes "__filename is not defined" as a MainFileESMOnlyError', async () => {
    vi.mocked(moduleUtils.importModule).mockRejectedValue(
      new ReferenceError('__filename is not defined')
    );

    await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
      MainFileESMOnlyError
    );
  });
});
