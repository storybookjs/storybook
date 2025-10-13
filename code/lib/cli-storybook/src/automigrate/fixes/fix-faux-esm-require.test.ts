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

    it('should return BannerConfig if file is ESM with require usage', async () => {
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

      expect(result).toEqual({
        hasRequireUsage: true,
        hasUnderscoreDirname: false,
        hasUnderscoreFilename: false,
      });
    });

    it('should return BannerConfig if file is ESM with __dirname usage but no definition', async () => {
      const contentWithDirname = `
        import { addons } from '@storybook/addon-essentials';
        const configPath = path.join(__dirname, 'config.js');
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(contentWithDirname);

      const result = await fixFauxEsmRequire.check({
        mainConfigPath: 'main.js',
      } as any);

      expect(result).toEqual({
        hasRequireUsage: false,
        hasUnderscoreDirname: true,
        hasUnderscoreFilename: false,
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
        mainConfigPath: 'main.ts',
      } as any);

      expect(result).toEqual({
        hasRequireUsage: true,
        hasUnderscoreDirname: false,
        hasUnderscoreFilename: false,
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
        result: {
          hasRequireUsage: true,
          hasUnderscoreDirname: false,
          hasUnderscoreFilename: false,
        },
      } as any);

      expect(mockWriteFile).toHaveBeenCalledWith(
        'main.js',
        expect.stringContaining('import { createRequire } from "node:module"')
      );
    });

    it('should add __dirname support when needed', async () => {
      const originalContent = `
        import { addons } from '@storybook/addon-essentials';
        const config = require('./some-config');
        const configPath = path.join(__dirname, 'config.js');
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(originalContent);

      await fixFauxEsmRequire.run({
        dryRun: false,
        mainConfigPath: 'main.js',
        result: {
          hasRequireUsage: true,
          hasUnderscoreDirname: true,
          hasUnderscoreFilename: false,
        },
      } as any);

      const writtenContent = mockWriteFile.mock.calls[0][1];
      expect(writtenContent).toMatchInlineSnapshot(`
        "
                import { fileURLToPath } from "node:url";
                import { dirname } from "node:path";
                import { createRequire } from "node:module";
                import { addons } from '@storybook/addon-essentials';
                const __filename = fileURLToPath("import.meta.url");
                const __dirname = dirname(__filename);
                const require = createRequire("import.meta.url");
                const config = require('./some-config');
                const configPath = path.join(__dirname, 'config.js');
                export default {
                  addons: ['@storybook/addon-essentials'],
                };
              "
      `);
    });

    it('should not add duplicate imports when they already exist', async () => {
      const originalContent = `
        import { dirname } from "node:path";
        import { addons } from '@storybook/addon-essentials';
        const config = require('./some-config');
        const configPath = path.join(__dirname, 'config.js');
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;

      mockReadFile.mockResolvedValue(originalContent);

      await fixFauxEsmRequire.run({
        dryRun: false,
        mainConfigPath: 'main.js',
        result: {
          hasRequireUsage: true,
          hasUnderscoreDirname: false,
          hasUnderscoreFilename: false,
        },
      } as any);

      const writtenContent = mockWriteFile.mock.calls[0][1];

      expect(writtenContent).toMatchInlineSnapshot(`
        "
                import { fileURLToPath } from "node:url";
                import { createRequire } from "node:module";
                import { dirname } from "node:path";
                import { addons } from '@storybook/addon-essentials';
                const require = createRequire("import.meta.url");
                const config = require('./some-config');
                const configPath = path.join(__dirname, 'config.js');
                export default {
                  addons: ['@storybook/addon-essentials'],
                };
              "
      `);
    });

    it('should not write file in dry run mode', async () => {
      await fixFauxEsmRequire.run({
        dryRun: true,
        mainConfigPath: 'main.js',
        result: {
          hasRequireUsage: true,
          hasUnderscoreDirname: false,
          hasUnderscoreFilename: false,
        },
      } as any);

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });
});
