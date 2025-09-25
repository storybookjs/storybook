import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  containsESMUsage,
  containsRequireUsage,
  getRequireBanner,
  hasRequireBanner,
} from '../helpers/mainConfigFile';
import { fixFauxEsmRequire } from './fix-faux-esm-require';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('storybook/internal/csf-tools', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/csf-tools')>()),
  readConfig: vi.fn(),
}));

describe('fix-faux-esm-require', () => {
  const mockPackageManager = {
    isStorybookInMonorepo: vi.fn(() => false),
  } as any;

  const mockReadFile = vi.mocked(readFile);
  const mockWriteFile = vi.mocked(writeFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if no mainConfigPath', async () => {
      const result = await fixFauxEsmRequire.check({
        packageManager: mockPackageManager,
        storybookVersion: '8.0.0',
        mainConfigPath: undefined,
      } as any);

      expect(result).toBeNull();
    });

    it('should return null if file is not ESM', async () => {
      const contentWithoutESM = `
        const config = require('./config');
        module.exports = config;
      `;

      mockReadFile.mockResolvedValue(contentWithoutESM);

      const result = await fixFauxEsmRequire.check({
        packageManager: mockPackageManager,
        storybookVersion: '8.0.0',
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBeNull();
    });

    it('should return null if file already has require banner', async () => {
      const contentWithBanner = `
        import { createRequire } from "node:module";
        // end of storybook 10 migration assistant header, you can delete the above code
        const config = require('./some-config');
      `;

      mockReadFile.mockResolvedValue(contentWithBanner);

      const result = await fixFauxEsmRequire.check({
        packageManager: mockPackageManager,
        storybookVersion: '8.0.0',
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBeNull();
    });

    it('should return null if file does not contain require usage', async () => {
      const contentWithoutRequire = `
        import { addons } from '@storybook/addon-essentials';
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(contentWithoutRequire);

      const result = await fixFauxEsmRequire.check({
        packageManager: mockPackageManager,
        storybookVersion: '8.0.0',
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBeNull();
    });

    it('should return options if file is ESM with require usage', async () => {
      const contentWithRequire = `
        import { addons } from '@storybook/addon-essentials';
        const config = require('./some-config');
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(contentWithRequire);

      const result = await fixFauxEsmRequire.check({
        packageManager: mockPackageManager,
        storybookVersion: '8.0.0',
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toEqual({
        storybookVersion: '8.0.0',
        isConfigTypescript: false,
      });
    });

    it('should detect TypeScript config files', async () => {
      const contentWithRequire = `
        import { addons } from '@storybook/addon-essentials';
        const config = require('./some-config');
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(contentWithRequire);

      const result = await fixFauxEsmRequire.check({
        packageManager: mockPackageManager,
        storybookVersion: '8.0.0',
        mainConfigPath: 'main.ts',
      } as any);

      expect(result).toEqual({
        storybookVersion: '8.0.0',
        isConfigTypescript: true,
      });
    });
  });

  describe('run', () => {
    it('should add require banner to file', async () => {
      const originalContent = `
        import { addons } from '@storybook/addon-essentials';
        const config = require('./some-config');
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(originalContent);

      await fixFauxEsmRequire.run({
        dryRun: false,
        mainConfigPath: 'main.js',
      } as any);

      expect(mockWriteFile).toHaveBeenCalledWith(
        'main.js',
        expect.stringContaining('import { createRequire } from "node:module"')
      );
    });

    it('should not write file in dry run mode', async () => {
      await fixFauxEsmRequire.run({
        dryRun: true,
        mainConfigPath: 'main.js',
      } as any);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
