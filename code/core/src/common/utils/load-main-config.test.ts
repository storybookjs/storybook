import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile, rm, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CommonJsGlobalInEsmError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';

import { fs as memfs, vol } from 'memfs';

import * as moduleUtils from '../../shared/utils/module.ts';
import * as interpretFiles from './interpret-files.ts';
import { loadMainConfig } from './load-main-config.ts';
import * as validateFiles from './validate-configuration-files.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('../../shared/utils/module.ts', { spy: true });
vi.mock('./interpret-files.ts', { spy: true });
vi.mock('./validate-configuration-files.ts', { spy: true });

let temporaryContent: string | undefined;

beforeEach(() => {
  vol.reset();
  vol.fromJSON({ [resolve('.storybook/main.ts')]: 'export default {};' });
  temporaryContent = undefined;
  vi.mocked(moduleUtils.importModule).mockReset();
  vi.mocked(readFile)
    .mockReset()
    .mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.mocked(writeFile)
    .mockReset()
    .mockImplementation(memfs.promises.writeFile as typeof writeFile);
  vi.mocked(rm)
    .mockReset()
    .mockImplementation(memfs.promises.rm as typeof rm);
  vi.mocked(validateFiles.validateConfigurationFiles).mockReset().mockResolvedValue(undefined);
  vi.mocked(interpretFiles.getInterpretedFile)
    .mockReset()
    .mockReturnValue(resolve('.storybook/main.ts'));
});

afterEach(() => {
  vol.reset();
});

describe('loadMainConfig', () => {
  describe('when the config loads cleanly', () => {
    beforeEach(() => {
      vi.mocked(moduleUtils.importModule).mockResolvedValueOnce({ stories: [] });
    });

    it('returns the config', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).resolves.toEqual({ stories: [] });
    });
  });

  describe('when importing throws a bare CommonJS-global error', () => {
    beforeEach(() => {
      // Thrown at hook-call time inside e.g. a helper: no "in ES module scope" suffix, so the
      // migration-assistant polyfill never triggers.
      vi.mocked(moduleUtils.importModule).mockRejectedValueOnce(
        new ReferenceError('__dirname is not defined')
      );
    });

    it('categorizes the error', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
        CommonJsGlobalInEsmError
      );
      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe('when the polyfill retry fails in an imported file', () => {
    beforeEach(() => {
      // First import fails with the ESM-scope variant (triggers the polyfill), the retry of the
      // temp file fails again because the offending global lives in an imported file.
      const retryError = new ReferenceError('__dirname is not defined in ES module scope');
      retryError.stack = [
        'ReferenceError: __dirname is not defined in ES module scope',
        `    at ${pathToFileURL(resolve('.storybook/paths.ts')).href}:2:21`,
        `    at ${pathToFileURL(resolve('.storybook/main.tmp..ts')).href}:9:1`,
      ].join('\n');
      vi.mocked(moduleUtils.importModule)
        .mockRejectedValueOnce(new ReferenceError('__dirname is not defined in ES module scope'))
        .mockImplementationOnce(async (path) => {
          temporaryContent = await readFile(path, 'utf8');
          throw retryError;
        });
    });

    it('categorizes the error and names the imported file', async () => {
      const error = (await loadMainConfig({ configDir: '.storybook' }).catch(
        (e: unknown) => e
      )) as Error;

      expect(error).toBeInstanceOf(CommonJsGlobalInEsmError);
      // The subject names the imported file, and never the throwaway temp copy.
      const subject = error.message.split('\n')[0];
      expect(subject).toContain(join('.storybook', 'paths.ts'));
      expect(subject).not.toContain('main.tmp');
      expect(temporaryContent).toContain('const __dirname = dirname(__filename)');
      expect(memfs.existsSync(resolve('.storybook/main.tmp..ts'))).toBe(false);
      expect(memfs.readFileSync(resolve('.storybook/main.ts'), 'utf8')).toBe('export default {};');
    });
  });

  describe('when importing throws an unrelated error', () => {
    beforeEach(() => {
      vi.mocked(moduleUtils.importModule).mockRejectedValueOnce(new Error('some syntax error'));
    });

    it('falls back to MainFileEvaluationError', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
        MainFileEvaluationError
      );
    });
  });
  describe('when skipCache is requested', () => {
    beforeEach(() => {
      vi.mocked(moduleUtils.importModule).mockResolvedValueOnce({ stories: [] });
    });

    it('passes skipCache to the initial import', async () => {
      await loadMainConfig({ configDir: '.storybook', skipCache: true });
      expect(moduleUtils.importModule).toHaveBeenCalledWith(resolve('.storybook/main.ts'), {
        skipCache: true,
      });
      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe('when the polyfill retry succeeds', () => {
    beforeEach(() => {
      vi.mocked(moduleUtils.importModule)
        .mockRejectedValueOnce(new ReferenceError('__dirname is not defined in ES module scope'))
        .mockImplementationOnce(async (path) => {
          temporaryContent = await readFile(path, 'utf8');
          return { stories: [] };
        });
    });

    it('returns the config and removes the temporary file', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).resolves.toEqual({ stories: [] });
      expect(temporaryContent).toContain('const __dirname = dirname(__filename)');
      expect(temporaryContent).toContain('export default {};');
      expect(memfs.existsSync(resolve('.storybook/main.tmp..ts'))).toBe(false);
      expect(memfs.readFileSync(resolve('.storybook/main.ts'), 'utf8')).toBe('export default {};');
    });
  });

  describe.each([null, 'rejected without an Error'])(
    'when the initial rejection is %j',
    (value) => {
      beforeEach(() => {
        vi.mocked(moduleUtils.importModule).mockRejectedValueOnce(value);
      });

      it('preserves the non-Error rejection', async () => {
        await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBe(value);
        expect(writeFile).not.toHaveBeenCalled();
      });
    }
  );

  describe('when the retry throws a non-Error value', () => {
    beforeEach(() => {
      vi.mocked(moduleUtils.importModule)
        .mockRejectedValueOnce(new ReferenceError('__dirname is not defined in ES module scope'))
        .mockImplementationOnce(async (path) => {
          temporaryContent = await readFile(path, 'utf8');
          throw 'retry failed';
        });
    });

    it('preserves the rejection and removes the temporary file', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBe('retry failed');
      expect(temporaryContent).toContain('const __dirname = dirname(__filename)');
      expect(temporaryContent).toContain('export default {};');
      expect(memfs.existsSync(resolve('.storybook/main.tmp..ts'))).toBe(false);
      expect(memfs.readFileSync(resolve('.storybook/main.ts'), 'utf8')).toBe('export default {};');
    });
  });

  describe('when the retry throws an unrelated error', () => {
    let original: SyntaxError;
    beforeEach(() => {
      original = new SyntaxError('invalid config');
      vi.mocked(moduleUtils.importModule)
        .mockRejectedValueOnce(new ReferenceError('__dirname is not defined in ES module scope'))
        .mockImplementationOnce(async (path) => {
          temporaryContent = await readFile(path, 'utf8');
          throw original;
        });
    });

    it('wraps the error and removes the temporary file', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toMatchObject({
        constructor: MainFileEvaluationError,
        data: { error: original },
      });
      expect(temporaryContent).toContain('const __dirname = dirname(__filename)');
      expect(temporaryContent).toContain('export default {};');
      expect(memfs.existsSync(resolve('.storybook/main.tmp..ts'))).toBe(false);
      expect(memfs.readFileSync(resolve('.storybook/main.ts'), 'utf8')).toBe('export default {};');
    });
  });

  describe('when the polyfill header is already present', () => {
    beforeEach(() => {
      memfs.writeFileSync(
        resolve('.storybook/main.ts'),
        '// end of Storybook 10 migration assistant header, you can delete the above code'
      );
      vi.mocked(moduleUtils.importModule).mockRejectedValueOnce(
        new ReferenceError('__dirname is not defined in ES module scope')
      );
    });

    it('does not add the polyfill again', async () => {
      await expect(loadMainConfig({ configDir: '.storybook' })).rejects.toBeInstanceOf(
        CommonJsGlobalInEsmError
      );
      expect(moduleUtils.importModule).toHaveBeenCalledTimes(1);
      expect(writeFile).not.toHaveBeenCalled();
    });
  });
});
