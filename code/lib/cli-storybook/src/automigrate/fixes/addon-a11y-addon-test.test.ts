import { beforeEach, describe, expect, it, vi } from 'vitest';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import dedent from 'ts-dedent';

import { getAddonNames } from '../helpers/mainConfigFile';
import { addonA11yAddonTest, transformSetupFile } from './addon-a11y-addon-test';

vi.mock('../helpers/mainConfigFile');

// mock fs.existsSync
vi.mock('fs', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

describe('addonA11yAddonTest', () => {
  const configDir = '/path/to/config';
  const mainConfig = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if a11y addon is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue([]);
      const result = await addonA11yAddonTest.check({ mainConfig, configDir } as any);
      expect(result).toBeNull();
    });

    it('should return null if test addon is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-a11y']);
      const result = await addonA11yAddonTest.check({ mainConfig, configDir } as any);
      expect(result).toBeNull();
    });

    it('should return null if configDir is not provided', async () => {
      const result = await addonA11yAddonTest.check({ mainConfig, configDir: '' } as any);
      expect(result).toBeNull();
    });

    it('should return setupFile and transformedSetupCode if vitest.setup file exists', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/experimental-addon-test',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('const annotations = setProjectAnnotations([]);');

      const result = await addonA11yAddonTest.check({ mainConfig, configDir } as any);
      expect(result).toEqual({
        setupFile: path.join(configDir, 'vitest.setup.js'),
        transformedSetupCode: expect.any(String),
      });
    });

    it('should return setupFile and null transformedSetupCode if transformation fails', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/experimental-addon-test',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await addonA11yAddonTest.check({ mainConfig, configDir } as any);
      expect(result).toEqual({
        setupFile: path.join(configDir, 'vitest.setup.js'),
        transformedSetupCode: null,
      });
    });
  });

  describe('prompt', () => {
    it('should return manual prompt if setupFile is null', () => {
      const result = addonA11yAddonTest.prompt({ setupFile: null, transformedSetupCode: null });
      expect(result).toContain("We couldn't find or automatically update your");
    });

    it('should return auto prompt if setupFile and transformedSetupCode are present', () => {
      const result = addonA11yAddonTest.prompt({
        setupFile: '/path/to/vitest.setup.ts',
        transformedSetupCode: 'transformed code',
      });
      expect(result).toContain('In order for these checks to be enabled we have to update your');
    });
  });

  describe('run', () => {
    it('should write transformed setup code to file', async () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const transformedSetupCode = 'transformed code';

      await addonA11yAddonTest.run?.({ result: { setupFile, transformedSetupCode } } as any);

      expect(writeFileSync).toHaveBeenCalledWith(setupFile, transformedSetupCode, 'utf8');
    });

    it('should not write to file if setupFile or transformedSetupCode is null', async () => {
      await addonA11yAddonTest.run?.({
        result: { setupFile: null, transformedSetupCode: null },
      } as any);

      expect(writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('transformSetupFile', async () => {
    it('should throw', async () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const source = dedent`
        import { beforeAll } from 'vitest';
        import { setProjectAnnotations } from 'storybook';

        beforeAll(project.beforeAll);
      `;

      vi.mocked(readFileSync).mockReturnValue(source);

      expect(() => transformSetupFile(setupFile)).toThrow();
    });

    it('should transform setup file correctly - 1', () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const source = dedent`
        import { beforeAll } from 'vitest';
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        const project = setProjectAnnotations([projectAnnotations]);

        beforeAll(project.beforeAll);
      `;
      vi.mocked(readFileSync).mockReturnValue(source);

      const transformedCode = transformSetupFile(setupFile);
      expect(transformedCode).toMatchInlineSnapshot(`
        "import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
        import { beforeAll } from 'vitest';
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        const project = setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);

        beforeAll(project.beforeAll);"
      `);
    });

    it('should transform setup file correctly - 2 (different format)', () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const source = dedent`
        import { beforeAll } from 'vitest';
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        const project = setProjectAnnotations([
          projectAnnotations
        ]);

        beforeAll(project.beforeAll);
      `;
      vi.mocked(readFileSync).mockReturnValue(source);

      const transformedCode = transformSetupFile(setupFile);
      expect(transformedCode).toMatchInlineSnapshot(`
        "import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
        import { beforeAll } from 'vitest';
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        const project = setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);

        beforeAll(project.beforeAll);"
      `);
    });
  });
});
