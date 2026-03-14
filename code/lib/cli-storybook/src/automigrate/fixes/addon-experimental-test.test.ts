import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';
import type { PackageJson, StorybookConfig } from 'storybook/internal/types';

import { readFileSync, writeFileSync } from 'fs';

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

vi.mock('../../util', () => ({
  findFilesUp: vi.fn(),
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
    import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
    import { beforeAll } from 'vitest'
    import { setProjectAnnotations } from '@storybook/nextjs-vite'
    import * as projectAnnotations from './preview'
    
    const project = setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])
    
    beforeAll(project.beforeAll)
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
  // Mock the findFilesUp function
  const { findFilesUp } = await import('../../util');
  (findFilesUp as any).mockReturnValue(files);

  return addonExperimentalTest.check({
    packageManager: packageManager as any,
    storybookVersion,
    mainConfig: mainConfig as any,
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });
};

const packageManager = vi.mocked(JsPackageManager.prototype);

describe('addon-experimental-test fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    packageManager.getModulePackageJSON = vi.fn();
    // @ts-expect-error Ignore readonly property
    packageManager.primaryPackageJson = {
      packageJson: { devDependencies: {}, dependencies: {} },
      packageJsonPath: 'some/path',
      operationDir: 'some/path',
    };
    packageManager.runPackageCommand = vi.fn();
    packageManager.getAllDependencies = vi.fn();
    packageManager.addDependencies = vi.fn();
    packageManager.removeDependencies = vi.fn();

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
        isPackageInstalled: async () => false,
      };
      await expect(checkAddonExperimentalTest({ packageManager })).resolves.toBeNull();
    });

    it('should find files containing @storybook/experimental-addon-test', async () => {
      const packageManager = {
        isPackageInstalled: async (packageName: string) => {
          return packageName === '@storybook/experimental-addon-test';
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

  describe('run function', () => {
    it('should replace @storybook/experimental-addon-test in files', async () => {
      packageManager.getModulePackageJSON.mockImplementation(async (packageName: string) => {
        if (packageName === '@storybook/experimental-addon-test') {
          return {
            version: '8.6.0',
          };
        }
        if (packageName === 'storybook') {
          return {
            version: '9.0.0',
          };
        }
        return null;
      });

      // @ts-expect-error Ignore readonly property
      packageManager.primaryPackageJson = {
        packageJson: {
          dependencies: {},
          devDependencies: {
            '@storybook/experimental-addon-test': '8.6.0',
          },
        },
        packageJsonPath: '/some/path',
        operationDir: '/some/path',
      };

      const matchingFiles = ['.storybook/test-setup.ts', '.storybook/main.ts', 'vitest.setup.ts'];

      await addonExperimentalTest.run?.({
        result: {
          matchingFiles,
          hasPackageJsonDependency: true,
        },
        packageManager: packageManager as JsPackageManager,
        dryRun: false,
        storybookVersion: '9.0.0',
      } as any);

      // Check that each file was read and written with the replacement
      expect(readFileSync).toHaveBeenCalledTimes(3);
      expect(writeFileSync).toHaveBeenCalledTimes(3);

      // Verify writeFileSync was called with replaced content
      matchingFiles.forEach((file) => {
        expect(writeFileSync).toHaveBeenCalledWith(
          file,
          expect.stringContaining('@storybook/addon-vitest'),
          'utf-8'
        );
      });

      expect(writeFileSync).toHaveBeenCalledWith(
        'vitest.setup.ts',
        `
    import { setup } from '@storybook/addon-vitest';
    import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
    import { beforeAll } from 'vitest'
    import { setProjectAnnotations } from '@storybook/nextjs-vite'
    import * as projectAnnotations from './preview'
    
    const project = setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])
  `,
        'utf-8'
      );

      // Verify package dependencies were updated
      expect(packageManager.removeDependencies).toHaveBeenCalledWith([
        '@storybook/experimental-addon-test',
      ]);

      expect(packageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        ['@storybook/addon-vitest@9.0.0']
      );
    });

    it('should replace @storybook/experimental-addon-test in files (dependency)', async () => {
      packageManager.getModulePackageJSON.mockImplementation(async (packageName: string) => {
        if (packageName === '@storybook/experimental-addon-test') {
          return {
            version: '8.6.0',
          };
        }
        if (packageName === 'storybook') {
          return {
            version: '9.0.0',
          };
        }
        return null;
      });

      // @ts-expect-error Ignore readonly property
      packageManager.primaryPackageJson = {
        packageJson: {
          dependencies: {
            '@storybook/experimental-addon-test': '8.6.0',
          },
          devDependencies: {},
        },
        packageJsonPath: '/some/path',
        operationDir: '/some/path',
      };

      const matchingFiles = ['.storybook/test-setup.ts', '.storybook/main.ts', 'vitest.setup.ts'];

      await addonExperimentalTest.run?.({
        result: {
          matchingFiles,
          hasPackageJsonDependency: true,
        },
        packageManager: packageManager as any,
        dryRun: false,
        storybookVersion: '9.0.0',
      } as any);

      expect(packageManager.addDependencies).toHaveBeenCalledWith(
        { type: 'devDependencies', skipInstall: true },
        ['@storybook/addon-vitest@9.0.0']
      );
    });

    it('should not modify files or dependencies in dry run mode', async () => {
      const packageManager = {
        getModulePackageJSON: () =>
          ({
            version: '0.2.0',
          }) as PackageJson,
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
        storybookVersion: '9.0.0',
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
