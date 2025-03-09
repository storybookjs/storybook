/* eslint-disable depend/ban-dependencies */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { readFileSync, writeFileSync } from 'fs';
import dedent from 'ts-dedent';

import { addonExperimentalTest } from './addon-experimental-test';

// Mock filesystem and globby
vi.mock('fs', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// mock picocolors yellow and cyan
vi.mock('picocolors', () => {
  return {
    default: {
      cyan: (str: string) => str,
    },
  };
});

// Mock the dynamic import of globby
vi.mock('globby', () => ({
  globbySync: vi.fn(),
}));

const mockFiles: Record<string, string> = {
  '.storybook/test-setup.ts': `
    import { setup } from '@storybook/experimental-addon-test';
    // Setup code here
  `,
  '.storybook/main.ts': `
    import type { StorybookConfig } from '@storybook/react-vite';

    const config: StorybookConfig = {
      addons: ['@storybook/experimental-addon-test'],
    };

    export default config;
  `,
  'vitest.setup.ts': `
    import { setup } from '@storybook/experimental-addon-test';
    // Vitest setup
  `,
  'vite.config.ts': `
    import { defineConfig } from 'vite';
    import { test } from '@storybook/experimental-addon-test';

    export default defineConfig({
      // Some config
    });
  `,
};

const checkAddonExperimentalTest = async ({
  packageManager = {},
  mainConfig = {},
  storybookVersion = '8.0.0',
  files = Object.keys(mockFiles),
}: {
  packageManager?: Partial<JsPackageManager>;
  mainConfig?: Partial<StorybookConfig>;
  storybookVersion?: string;
  files?: string[];
}) => {
  // Mock the globbySync function from the globby module
  const globbyModule = await import('globby');
  (globbyModule.globbySync as any).mockReturnValue(files);

  return addonExperimentalTest.check({
    packageManager: packageManager as any,
    storybookVersion,
    mainConfig: mainConfig as any,
  });
};

describe('addon-experimental-test fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error Ignore
    vi.mocked(readFileSync).mockImplementation((file: string) => {
      if (mockFiles[file]) {
        return mockFiles[file];
      }
      throw new Error(`File not found: ${file}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('check function', () => {
    it('should return null if @storybook/experimental-addon-test is not installed', async () => {
      const packageManager = {
        getPackageVersion: () => Promise.resolve(null),
      };
      await expect(checkAddonExperimentalTest({ packageManager })).resolves.toBeNull();
    });

    it('should find files containing @storybook/experimental-addon-test', async () => {
      const packageManager = {
        getPackageVersion: (packageName: string) => {
          if (packageName === '@storybook/experimental-addon-test') {
            return Promise.resolve('8.6.0');
          }
          if (packageName === 'storybook') {
            return Promise.resolve('9.0.0');
          }
          return Promise.resolve(null);
        },
      };

      const result = await checkAddonExperimentalTest({ packageManager });
      expect(result).toEqual({
        matchingFiles: [
          '.storybook/test-setup.ts',
          '.storybook/main.ts',
          'vitest.setup.ts',
          'vite.config.ts',
        ],
      });
    });
  });

  describe('prompt function', () => {
    it('should render properly with few files', () => {
      const matchingFiles = ['.storybook/test-setup.ts', '.storybook/main.ts'];

      const promptResult = addonExperimentalTest.prompt({ matchingFiles });
      expect(promptResult).toMatchInlineSnapshot(dedent`
        "We've detected you're using @storybook/experimental-addon-test, which is now available as a stable addon.

        We can automatically migrate your project to use @storybook/addon-test instead.

        This will update 2 file(s) and your package.json:
          - .storybook/test-setup.ts
          - .storybook/main.ts"
      `);
    });

    it('should render properly with many files', () => {
      const matchingFiles = [
        '.storybook/test-setup.ts',
        '.storybook/main.ts',
        'vitest.setup.ts',
        'vite.config.ts',
        '.storybook/preview.ts',
        '.storybook/preview.js',
        '.storybook/main.js',
      ];

      const promptResult = addonExperimentalTest.prompt({ matchingFiles });
      expect(promptResult).toMatchInlineSnapshot(dedent`
        "We've detected you're using @storybook/experimental-addon-test, which is now available as a stable addon.

        We can automatically migrate your project to use @storybook/addon-test instead.

        This will update 7 file(s) and your package.json:
          - .storybook/test-setup.ts
          - .storybook/main.ts
          - vitest.setup.ts
          - vite.config.ts
          - .storybook/preview.ts
          ... and 2 more files"
      `);
    });
  });

  describe('run function', () => {
    it('should replace @storybook/experimental-addon-test in files', async () => {
      const packageManager = {
        getPackageVersion: (packageName: string) => {
          if (packageName === '@storybook/experimental-addon-test') {
            return Promise.resolve('8.6.0');
          }
          if (packageName === 'storybook') {
            return Promise.resolve('9.0.0');
          }
          return Promise.resolve(null);
        },
        retrievePackageJson: () =>
          Promise.resolve({
            dependencies: {},
            devDependencies: {
              '@storybook/experimental-addon-test': '8.6.0',
            },
          }),
        removeDependencies: vi.fn(() => Promise.resolve()),
        addDependencies: vi.fn(() => Promise.resolve()),
      };

      const matchingFiles = ['.storybook/test-setup.ts', '.storybook/main.ts', 'vitest.setup.ts'];

      await addonExperimentalTest.run?.({
        result: {
          matchingFiles,
          hasPackageJsonDependency: true,
        },
        packageManager: packageManager as any,
        dryRun: false,
      } as any);

      // Check that each file was read and written with the replacement
      expect(readFileSync).toHaveBeenCalledTimes(3);
      expect(writeFileSync).toHaveBeenCalledTimes(3);

      // Verify writeFileSync was called with replaced content
      matchingFiles.forEach((file) => {
        expect(writeFileSync).toHaveBeenCalledWith(
          file,
          expect.stringContaining('@storybook/addon-test'),
          'utf-8'
        );
      });

      // Verify package dependencies were updated
      expect(packageManager.removeDependencies).toHaveBeenCalledWith({}, [
        '@storybook/experimental-addon-test',
      ]);

      expect(packageManager.addDependencies).toHaveBeenCalledWith(
        { installAsDevDependencies: true },
        ['@storybook/addon-test@9.0.0']
      );
    });

    it('should replace @storybook/experimental-addon-test in files (dependency)', async () => {
      const packageManager = {
        getPackageVersion: (packageName: string) => {
          if (packageName === '@storybook/experimental-addon-test') {
            return Promise.resolve('8.6.0');
          }
          if (packageName === 'storybook') {
            return Promise.resolve('9.0.0');
          }
          return Promise.resolve(null);
        },
        retrievePackageJson: () =>
          Promise.resolve({
            dependencies: {
              '@storybook/experimental-addon-test': '8.6.0',
            },
            devDependencies: {},
          }),
        removeDependencies: vi.fn(() => Promise.resolve()),
        addDependencies: vi.fn(() => Promise.resolve()),
      };

      const matchingFiles = ['.storybook/test-setup.ts', '.storybook/main.ts', 'vitest.setup.ts'];

      await addonExperimentalTest.run?.({
        result: {
          matchingFiles,
          hasPackageJsonDependency: true,
        },
        packageManager: packageManager as any,
        dryRun: false,
      } as any);

      expect(packageManager.addDependencies).toHaveBeenCalledWith(
        { installAsDevDependencies: false },
        ['@storybook/addon-test@9.0.0']
      );
    });

    it('should not modify files or dependencies in dry run mode', async () => {
      const packageManager = {
        getPackageVersion: () => Promise.resolve('0.2.0'),
        removeDependencies: vi.fn(),
        addDependencies: vi.fn(),
      };

      const matchingFiles = ['.storybook/test-setup.ts'];

      await addonExperimentalTest.run?.({
        result: {
          matchingFiles,
          hasPackageJsonDependency: true,
        },
        packageManager: packageManager as any,
        dryRun: true,
      } as any);

      // Files should be read but not written in dry run mode
      expect(readFileSync).toHaveBeenCalledTimes(1);
      expect(writeFileSync).not.toHaveBeenCalled();

      // Package dependencies should not be modified in dry run mode
      expect(packageManager.removeDependencies).not.toHaveBeenCalled();
      expect(packageManager.addDependencies).not.toHaveBeenCalled();
    });
  });
});
