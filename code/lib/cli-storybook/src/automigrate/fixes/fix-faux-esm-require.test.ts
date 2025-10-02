import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bannerComment } from '../helpers/mainConfigFile';
import { fixFauxEsmRequire } from './fix-faux-esm-require';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe('fix-faux-esm-require', () => {
  const mockReadFile = vi.mocked(readFile);
  const mockWriteFile = vi.mocked(writeFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if no mainConfigPath', async () => {
      const result = await fixFauxEsmRequire.check({
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
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBeNull();
    });

    it('should return null if file already has require banner', async () => {
      const contentWithBanner = `
        import { createRequire } from "node:module";
        ${bannerComment}
        const config = require('./some-config');
      `;

      mockReadFile.mockResolvedValue(contentWithBanner);

      const result = await fixFauxEsmRequire.check({
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
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBeNull();
    });

    it('should return true if file is ESM with require usage', async () => {
      const contentWithRequire = `
        import { addons } from '@storybook/addon-essentials';
        const config = require('./some-config');
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(contentWithRequire);

      const result = await fixFauxEsmRequire.check({
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBe(true);
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
        mainConfigPath: 'main.ts',
      } as any);

      expect(result).toBe(true);
    });

    it('should return null if file already has createRequire import and require definition', async () => {
      const contentWithCreateRequire = `
        import type { StorybookConfig } from '@storybook/vue3-vite';
        import { createRequire } from 'module';
        import { join, dirname } from 'path';

        function getAbsolutePath(value: string): string {
          const require = createRequire(import.meta.url);
          return dirname(require.resolve(join(value, 'package.json')));
        }

        const config: StorybookConfig = {
          addons: [getAbsolutePath('@storybook/addon-a11y')],
        };

        export default config;
      `;

      mockReadFile.mockResolvedValue(contentWithCreateRequire);

      const result = await fixFauxEsmRequire.check({
        mainConfigPath: 'main.ts',
      } as any);

      expect(result).toBeNull();
    });

    it('should return null if file has createRequire with node: prefix and require definition', async () => {
      const contentWithNodePrefix = `
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        const config = require('./some-config');
        export default config;
      `;

      mockReadFile.mockResolvedValue(contentWithNodePrefix);

      const result = await fixFauxEsmRequire.check({
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBeNull();
    });

    it('should return true if file has createRequire import but no require definition', async () => {
      const contentWithImportOnly = `
        import { createRequire } from 'module';
        import { something } from './other';
        const config = require('./some-config');
        export default config;
      `;

      mockReadFile.mockResolvedValue(contentWithImportOnly);

      const result = await fixFauxEsmRequire.check({
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBe(true);
    });

    it('should return true if file has require definition but no createRequire import', async () => {
      const contentWithDefinitionOnly = `
        import { something } from './other';
        const require = createRequire(import.meta.url);
        const config = require('./some-config');
        export default config;
      `;

      mockReadFile.mockResolvedValue(contentWithDefinitionOnly);

      const result = await fixFauxEsmRequire.check({
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toBe(true);
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
