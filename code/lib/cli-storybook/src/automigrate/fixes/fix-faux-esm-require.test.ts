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

describe('fix-faux-esm-require-utils', () => {
  describe('containsESMUsage', () => {
    it('should return true for .mjs files', () => {
      expect(containsESMUsage('main.mjs', 'export default {}')).toBe(true);
    });

    it('should return true for .mts files', () => {
      expect(containsESMUsage('main.mts', 'export default {}')).toBe(true);
    });

    it('should return true for .mtsx files', () => {
      expect(containsESMUsage('main.mtsx', 'export default {}')).toBe(true);
    });

    it('should return true for .js files with ESM syntax', () => {
      const esmContent = `
        import { addons } from '@storybook/addon-essentials';
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;
      expect(containsESMUsage('main.js', esmContent)).toBe(true);
    });

    it('should return true for .ts files with ESM syntax', () => {
      const esmContent = `
        import { addons } from '@storybook/addon-essentials';
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;
      expect(containsESMUsage('main.ts', esmContent)).toBe(true);
    });

    it('should return true for .tsx files with ESM syntax', () => {
      const esmContent = `
        import { addons } from '@storybook/addon-essentials';
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;
      expect(containsESMUsage('main.tsx', esmContent)).toBe(true);
    });

    it('should return false for .js files with CommonJS syntax', () => {
      const commonjsContent = `
        const config = require('./config');
        module.exports = config;
      `;
      expect(containsESMUsage('main.js', commonjsContent)).toBe(false);
    });

    it('should return false for .cjs files', () => {
      expect(containsESMUsage('main.cjs', 'module.exports = {}')).toBe(false);
    });

    it('should return true for files with import.meta', () => {
      const contentWithImportMeta = `
        const __filename = import.meta.url;
        export default {};
      `;
      expect(containsESMUsage('main.js', contentWithImportMeta)).toBe(true);
    });
  });

  describe('containsRequireUsage', () => {
    it('should detect require() calls', () => {
      const content = `
        const config = require('./config');
        export default config;
      `;
      expect(containsRequireUsage(content)).toBe(true);
    });

    it('should ignore require in comments', () => {
      const content = `
        // const config = require('./config');
        export default {};
      `;
      expect(containsRequireUsage(content)).toBe(false);
    });

    it('should ignore require in block comments', () => {
      const content = `
        /*
        const config = require('./config');
        */
        export default {};
      `;
      expect(containsRequireUsage(content)).toBe(false);
    });

    it('should return false when no require usage', () => {
      const content = `
        import { addons } from '@storybook/addon-essentials';
        export default {
          addons: ['@storybook/addon-essentials'],
        };
      `;
      expect(containsRequireUsage(content)).toBe(false);
    });
  });

  describe('hasRequireBanner', () => {
    it('should detect existing banner', () => {
      const content = `
        import { createRequire } from "node:module";
        // end of storybook 10 migration assistant header, you can delete the above code
        const config = require('./config');
      `;
      expect(hasRequireBanner(content)).toBe(true);
    });

    it('should return false when no banner', () => {
      const content = `
        const config = require('./config');
        export default config;
      `;
      expect(hasRequireBanner(content)).toBe(false);
    });
  });

  describe('getRequireBanner', () => {
    it('should generate banner', () => {
      const banner = getRequireBanner();
      expect(banner).toContain('import { createRequire } from "node:module"');
      expect(banner).toContain('import { dirname } from "node:path"');
      expect(banner).toContain('import { fileURLToPath } from "node:url"');
      expect(banner).toContain('const require = createRequire(import.meta.url)');
    });
  });
});
